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
          
          return config;
        } catch (error) {
          console.error('生成密钥对失败:', error.message);
          throw error;
        }
    },

    /**
     * 向服务器注册公钥 (setup环节调用)
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
            try {
              publicKey = await fs.readFile(publicKeyPath, 'utf8');
            } catch (error) {
              throw new Error(`无法读取公钥文件: ${error.message}`);
            }
          }
          
          // 设置请求头
          const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.STUDENT_API_KEY || 'testkey',
            'X-Student-ID': config.studentId
          };
          
          // 获取挑战码（首次注册也获取挑战码以统一流程）
          let challenge = '';
          let signature = '';
          try {
            console.log('获取认证挑战码...');
            const challengeRes = await axios.get(
              `${config.apiUrl}/students/auth/challenge/${config.studentId}`,
              { headers }
            );
            
            challenge = challengeRes.data.challenge;
            
            if (challenge) {
              // 使用私钥签名挑战码
              console.log('使用私钥签名挑战码...');
              const privateKeyPath = config.keyPair.privateKeyFile;
              try {
                const privateKey = await fs.readFile(privateKeyPath, 'utf8');
                const sign = crypto.createSign('SHA256');
                sign.update(challenge);
                sign.end();
                signature = sign.sign(privateKey, 'base64');
              } catch (error) {
                console.warn('无法签名挑战码:', error.message);
                // 继续注册流程，服务器可能允许首次注册时没有签名
              }
            }
          } catch (error) {
            console.warn('获取挑战码失败，尝试直接注册:', error.message);
            // 继续注册流程，服务器可能允许首次注册时没有挑战码
          }
          
          // 准备注册数据
          const registrationData = {
            publicKey,
            keyName: config.keyPair.name || `${os.hostname()}-${Date.now()}`,
            signature,
            challenge
          };
          
          console.log('注册数据准备完成，包含以下字段:', Object.keys(registrationData));
          
          try {
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
            // 处理不同类型的错误
            if (error.response?.status === 409) {
              // 409 Conflict - 服务器已有此学生的密钥
              error.response.data = error.response.data || {};
              error.response.data.keyExists = true;
              console.warn('公钥注册失败: 服务器已有此学生的密钥记录');
              console.warn('如果您更换了环境，请联系教师重置您的公钥');
            } else if (error.response?.status === 401) {
              console.warn('公钥注册失败: 认证失败，请检查学号和API密钥');
            } else {
              console.error('公钥注册失败:', error.message);
              if (error.response) {
                console.error('服务器错误:', error.response.data);
              }
            }
            throw error;
          }
        } catch (error) {
          console.error('注册公钥失败:', error.message);
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
                // 检查错误类型并做出相应处理
                if (verifyError.response) {
                    const errorData = verifyError.response.data;
                    
                    // 情况1: 需要重新注册密钥（教师已重置密钥）
                    if (errorData && errorData.requiresReregistration) {
                        console.log('服务器已重置密钥，需要重新生成和注册密钥...');
                        throw new Error('服务器已重置密钥，请重新运行 setup 命令生成和注册密钥');
                    } 
                    
                    // 情况2: 服务器没有该学生的公钥记录
                    else if (errorData && errorData.error && 
                            (errorData.error.includes('没有注册公钥') || 
                             errorData.error.includes('未找到公钥'))) {
                        console.error('服务器端没有找到公钥记录');
                        throw new Error('未在服务器上注册公钥，请先运行 setup 命令注册公钥');
                    } 
                    
                    // 情况3: 公钥不匹配（可能是学生更换了环境）
                    else if (errorData && errorData.error && 
                            (errorData.error.includes('验证失败') || 
                             errorData.error.includes('签名无效'))) {
                        console.error('签名验证失败，可能是您更换了环境或密钥被篡改');
                        throw new Error('签名验证失败，如果您更换了环境，请联系教师重置您的公钥，然后重新运行 setup 命令');
                    }
                }
                
                // 其他错误
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
              
              // 主动执行测试
              console.log('主动执行API测试...');
              try {
                  // 导入CommandHandler以便执行测试
                  const { default: CommandHandler } = await import('../core/command-handler.js');
                  
                  // 执行测试
                  await CommandHandler.runTests();
                  
                  // 获取测试结果
                  if (StudentAPI.lastTestResults) {
                      testResults = StudentAPI.lastTestResults;
                      console.log(`测试完成: ${testResults.totalPassed}/${testResults.totalPassed + testResults.totalFailed} 通过`);
                  } else {
                      console.warn('测试执行完成，但未找到测试结果');
                      testResults = {
                          score: 0,
                          maxPossibleScore: 0,
                          totalPassed: 0,
                          totalFailed: 0,
                          timestamp: new Date().toISOString(),
                          tests: []
                      };
                  }
              } catch (testError) {
                  console.error('执行测试失败:', testError.message);
                  // 即使测试失败，也提供一个有效的测试结果结构
                  testResults = {
                      score: 0,
                      maxPossibleScore: 0,
                      totalPassed: 0,
                      totalFailed: 0,
                      timestamp: new Date().toISOString(),
                      tests: [],
                      error: testError.message
                  };
              }
          } catch (error) {
              console.warn('获取API测试数据失败:', error.message);
              // 即使出错，也确保有一个有效的测试结果结构
              testResults = {
                  score: 0,
                  maxPossibleScore: 0,
                  totalPassed: 0,
                  totalFailed: 0,
                  timestamp: new Date().toISOString(),
                  tests: []
              };
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
              challenge: authData.challenge, 
              hardwareInfo,
              data: {
                  todoCount,
                  todos,
                  testResults
              }
          };
          
          // 添加安全检查，确保报告中没有NaN值
          const sanitizeReportData = (obj) => {
              if (!obj) return;
              Object.keys(obj).forEach(key => {
                  if (typeof obj[key] === 'number' && Number.isNaN(obj[key])) {
                      console.log(`警告: 字段 ${key} 是 NaN，自动修复为 0`);
                      obj[key] = 0;
                  } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                      sanitizeReportData(obj[key]);
                  }
              });
          };
          
          // 确保报告数据没有NaN值
          sanitizeReportData(reportData);
          
          return reportData;
      } catch (error) {
          console.error('创建报告数据失败:', error.message);
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
            
            // 设置请求头
            const headers = {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.STUDENT_API_KEY || 'testkey',
                'X-Student-ID': config.studentId
            };
            
            // 步骤1: 主动获取新的挑战码
            console.log('获取认证挑战码...');
            const challengeResponse = await axios.get(
                `${config.apiUrl}/students/challenge/${config.studentId}`
            );
            
            const challenge = challengeResponse.data.challenge;
            console.log('获取到新的挑战码');
            
            // 步骤2: 读取私钥并生成签名
            console.log('生成签名...');
            const privateKeyFile = config.keyPair.privateKeyFile;
            let privateKey;
            try {
                privateKey = await fs.readFile(privateKeyFile, 'utf8');
            } catch (err) {
                throw new Error('无法读取私钥: ' + err.message);
            }
            
            const sign = crypto.createSign('SHA256');
            sign.update(challenge);
            sign.end();
            const signature = sign.sign(privateKey, 'base64');
            
            // 步骤3: 添加签名到报告数据
            reportData.signature = signature;
            
            // 步骤4: 发送完整的报告
            console.log('发送报告到服务器...');
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
                    // 检查具体错误类型
                    const errorMsg = error.response.data.error || '未知错误';
                    
                    // 没有注册公钥
                    if (errorMsg.includes('没有注册公钥') || errorMsg.includes('未找到公钥')) {
                        throw new Error('未在服务器上注册公钥，请先运行 setup 命令注册公钥');
                    }
                    
                    // 签名验证失败 - 可能是环境变更
                    if (errorMsg.includes('签名验证失败') || errorMsg.includes('无效签名')) {
                        throw new Error('签名验证失败，如果您更换了环境，请联系教师重置您的公钥，然后重新运行 setup 命令');
                    }
                    
                    // 挑战码过期或无效 - 这种情况不应该经常发生，因为我们刚获取了新挑战码
                    if (errorMsg.includes('挑战码已过期') || errorMsg.includes('挑战码不存在')) {
                        throw new Error('挑战码验证失败，请稍后重试或联系教师');
                    }
                    
                    console.error('服务器响应错误:', error.response.data);
                    throw new Error(errorMsg);
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