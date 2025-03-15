// src/core/reporter-core.js
// 报告核心功能，负责数据收集和报告发送

import axios from 'axios';
import fs from 'fs/promises';
import crypto from 'crypto';
import os from 'os';
import { ConfigManager } from './config-manager.js';
import { HardwareInfo } from '../utils/hardware-info.js';

export const ReporterCore = {
    /**
     * 生成RSA密钥对并保存，同时注册到服务器
     * @param {Object} config 配置对象
     * @returns {Promise<Object>} 更新后的配置对象
     */
    async generateAndSaveKeyPair(config) {
        try {
        console.log('正在生成RSA密钥对...');
        
        // 创建RSA密钥对
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
            },
            privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
            }
        });
        
        // 获取密钥保存路径
        const { publicKeyPath, privateKeyPath } = ConfigManager.getKeyPaths();
        
        // 保存密钥到文件
        await fs.writeFile(publicKeyPath, publicKey);
        await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 }); // 更安全的权限
        
        // 更新配置
        const keyPair = {
            name: `${os.hostname()}-${Date.now()}`,
            created: new Date().toISOString(),
            publicKeyFile: publicKeyPath,
            privateKeyFile: privateKeyPath
        };
        
        config.keyPair = keyPair;
        await ConfigManager.saveConfig(config);
        
        console.log('密钥对已生成并保存');
        
        // 立即注册公钥到服务器
        try {
            console.log('向服务器注册新生成的公钥...');
            
            // 设置请求头
            const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.STUDENT_API_KEY || 'testkey',
            'X-Student-ID': config.studentId
            };
            
            // 准备注册数据
            const registrationData = {
            publicKey,
            keyName: keyPair.name
            };
            
            // 发送注册请求
            const registerResponse = await axios.post(
            `${config.apiUrl}/students/auth/register-key/${config.studentId}`,
            registrationData,
            { headers }
            );
            
            console.log('公钥注册成功:', registerResponse.data.message || '服务器接受了密钥');
            
            // 更新配置中的密钥ID
            if (registerResponse.data.keyId) {
            config.keyPair.keyId = registerResponse.data.keyId;
            await ConfigManager.saveConfig(config);
            }
        } catch (registerError) {
            console.warn('公钥注册失败:', registerError.message);
            console.warn('请稍后再次尝试注册或手动重新运行setup');
            // 不抛出错误，允许继续使用生成的密钥
        }
        
        return config;
        } catch (error) {
        console.error('生成密钥对失败:', error.message);
        throw error;
        }
    },
  
    /**
     * 认证过程
     * @param {Object} config 配置对象
     * @returns {Promise<Object>} 认证数据
     */
    async authenticate(config) {
        try {
        console.log('正在进行认证...');
        
        // 检查是否有密钥对
        if (!config.keyPair) {
            throw new Error('未找到密钥对，请先运行 setup 命令');
        }
        
        // 获取密钥文件路径
        const { privateKeyFile } = config.keyPair;
        
        // 读取私钥
        let privateKey;
        try {
            privateKey = await fs.readFile(privateKeyFile, 'utf8');
        } catch (error) {
            throw new Error('密钥文件不存在或无法读取: ' + error.message);
        }
        
        // 获取挑战码 - 这是认证的第一步
        console.log('获取挑战码...');
        const challengeResponse = await axios.get(
            `${config.apiUrl}/students/auth/challenge/${config.studentId}`
        );
        
        console.log('服务器响应状态:', challengeResponse.status);
        
        // 确保有挑战码
        const { challenge } = challengeResponse.data;
        if (!challenge) {
            console.error('警告: 挑战码为空或未定义');
            console.error('服务器响应:', JSON.stringify(challengeResponse.data, null, 2));
            throw new Error('服务器未返回有效的挑战码');
        }
        
        console.log('收到挑战码:', challenge);
        
        // 使用私钥签名挑战码
        console.log('正在签名挑战码...');
        const sign = crypto.createSign('SHA256');
        sign.update(challenge);
        sign.end();
        const signature = sign.sign(privateKey, 'base64');
        
        console.log('挑战码签名完成');
        
        // 验证签名 - 正常认证流程的核心
        try {
            console.log('验证签名...');
            const verifyResponse = await axios.post(
            `${config.apiUrl}/students/auth/verify/${config.studentId}`,
            { signature, challenge }
            );
            console.log('签名验证成功:', verifyResponse.data.message || '验证通过');
        } catch (verifyError) {
            // 如果验证失败，检查是否需要重新注册密钥
            if (verifyError.response?.data?.requiresReregistration) {
            console.log('服务器已重置密钥，需要重新生成和注册密钥...');
            // 重新生成密钥并注册
            await this.generateAndSaveKeyPair(config);
            // 重新认证
            return await this.authenticate(config);
            }
            
            console.error('签名验证失败:', verifyError.message);
            if (verifyError.response && verifyError.response.data) {
            console.error('服务器错误详情:', verifyError.response.data);
            }
            throw verifyError;
        }
        
        return {
            challenge,
            signature
        };
        } catch (error) {
        console.error('认证失败:', error.message);
        throw error;
        }
    },
  
  /**
   * 创建报告数据
   * @param {Object} config 配置对象
   * @param {Object} authData 认证数据
   * @returns {Promise<Object>} 报告数据
   */
  async createReportData(config, authData) {
    try {
      console.log('收集系统信息...');
      
      // 获取硬件信息
      const hardwareInfo = await HardwareInfo.collect();
      
      // 获取待办事项数据
      let todos = [];
      let todoCount = 0;
      let testResults = null;
      
      // 尝试从学生API获取数据
      try {
        console.log('获取API测试数据...');
        
        // 动态导入学生API
        const { default: StudentAPI } = await import('../api/student-api.js');
        
        // 获取待办事项
        try {
          const response = await axios.get(`${StudentAPI.API_BASE_URL}/todos`);
          todos = Array.isArray(response.data) ? response.data : [];
          todoCount = todos.length;
          console.log(`找到 ${todoCount} 个待办事项`);
        } catch (error) {
          console.warn('获取待办事项失败:', error.message);
        }
        
        // 这里不立即运行测试，等待服务器命令
      } catch (error) {
        console.warn('获取API测试数据失败:', error.message);
      }
      
      // 创建报告数据
      const reportData = {
        studentId: config.studentId,
        name: config.name || os.userInfo().username,
        apiVersion: config.apiVersion || '1.0.0',
        ipAddress: await this.getIPAddress(),
        port: 3000, // 假设API在3000端口
        timestamp: new Date().toISOString(),
        signature: authData.signature,
        hardwareInfo,
        data: {
          todoCount,
          todos,
          testResults
        }
      };
      
      return reportData;
    } catch (error) {
      console.error('创建报告数据失败:', error.message);
      throw error;
    }
  },
  
  /**
   * 向服务器注册公钥
   * @param {Object} config 配置对象
   * @param {string} publicKeyContent 公钥内容，可选，如不提供则从文件读取
   * @returns {Promise<Object>} 注册结果
   */
  async registerPublicKey(config, publicKeyContent = null) {
    try {
      console.log('向服务器注册公钥...');
      
      // 确保有密钥对
      if (!config.keyPair) {
        throw new Error('未找到密钥对，无法注册公钥');
      }
      
      // 如果没有提供公钥内容，则从文件读取
      let publicKey = publicKeyContent;
      if (!publicKey) {
        const publicKeyPath = config.keyPair.publicKeyFile;
        publicKey = await fs.readFile(publicKeyPath, 'utf8');
      }
      
      // 查看服务器路由中要求的参数
      // 通过检查routes/students.js中的/auth/register-key/:studentId路由
      const registrationData = {
        publicKey,
        keyName: config.keyPair.name || `${os.hostname()}-${Date.now()}`,
        // 添加服务器可能需要的其他参数
        signature: '', // 如果需要，首次注册可能不需要签名
        challenge: '' // 如果需要，首次注册可能不需要挑战码
      };
      
      console.log('注册数据准备完成，包含以下字段:', Object.keys(registrationData));
      
      // 设置请求头 - 重要，确保API密钥正确传递
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.STUDENT_API_KEY || 'testkey', // 实际环境中应从安全来源获取
        'X-Student-ID': config.studentId
      };
      
      console.log(`发送请求到: ${config.apiUrl}/students/auth/register-key/${config.studentId}`);
      
      // 向服务器发送注册请求
      const response = await axios.post(
        `${config.apiUrl}/students/auth/register-key/${config.studentId}`,
        registrationData,
        { headers }
      );
      
      console.log('公钥注册成功:', response.data.message || '服务器接受了密钥');
      
      // 更新配置中的密钥信息（如果服务器返回了keyId）
      if (response.data.keyId) {
        config.keyPair.keyId = response.data.keyId;
        await ConfigManager.saveConfig(config);
      }
      
      return response.data;
    } catch (error) {
      console.error('注册公钥失败:', error.message);
      if (error.response) {
        console.error('服务器错误:', error.response.data);
        // 输出详细错误信息以便调试
        console.log('请求状态码:', error.response.status);
        console.log('请求头:', error.response.headers);
        if (error.request) {
          console.log('请求内容:', error.request);
        }
      }
      throw error;
    }
  },

  /**
   * 发送报告
   * @param {Object} config 配置对象
   * @param {Object} reportData 报告数据
   * @returns {Promise<Object>} 服务器响应
   */
  async sendReport(config, reportData) {
    try {
      console.log('发送API状态报告...');
      console.log('发送报告到服务器...');
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.STUDENT_API_KEY || 'testkey', // 实际环境中应从安全来源获取
        'X-Student-ID': config.studentId
      };
      
      // 确保包含签名和硬件信息
      if (!reportData.signature) {
        console.warn('警告: 报告数据中没有签名');
      }
      
      // 发送报告
      try {
        const response = await axios.post(
          `${config.apiUrl}/students/report`,
          reportData,
          { headers }
        );
        
        console.log('报告发送成功:', response.data.message || '服务器已接收报告');
        
        // 检查是否有待处理的命令
        if (response.data.command) {
          console.log(`服务器发送命令: ${response.data.command}`);
          // 命令处理逻辑由其他模块实现
        }
        
        return response.data;
      } catch (error) {
        if (error.response && error.response.data) {
          // 检查是否需要重新认证
          if (error.response.data.requiresAuth && error.response.data.challenge) {
            console.log('服务器要求重新认证，收到新挑战码，正在重新生成签名...');
            const newChallenge = error.response.data.challenge;
            
            // 读取私钥
            const privateKeyFile = config.keyPair.privateKeyFile;
            let privateKey;
            try {
              privateKey = await fs.readFile(privateKeyFile, 'utf8');
            } catch (err) {
              throw new Error('无法读取私钥: ' + err.message);
            }
            
            // 使用新挑战码生成新签名
            const sign = crypto.createSign('SHA256');
            sign.update(newChallenge);
            sign.end();
            const newSignature = sign.sign(privateKey, 'base64');
            
            console.log('已生成新签名，重新发送报告...');
            
            // 更新报告数据中的签名
            reportData.signature = newSignature;
            
            // 重新发送请求
            const retryResponse = await axios.post(
              `${config.apiUrl}/students/report`,
              reportData,
              { headers }
            );
            
            console.log('报告重新发送成功:', retryResponse.data.message || '服务器已接收报告');
            
            return retryResponse.data;
          } else {
            console.error('服务器响应错误:', error.response.data);
            throw error.response.data;
          }
        } else {
          console.error('发送报告失败:', error.message);
          throw error;
        }
      }
    } catch (error) {
      console.error('报告发送失败:', error);
      throw error;
    }
  },
  
  /**
   * 获取IP地址
   * @returns {Promise<string>} IP地址
   */
  async getIPAddress() {
    // 获取所有网络接口
    const interfaces = os.networkInterfaces();
    
    // 尝试找到一个非本地的IPv4地址
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // 跳过内部/本地地址
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    
    // 如果没有找到，返回localhost
    return '127.0.0.1';
  }
};

export default ReporterCore;