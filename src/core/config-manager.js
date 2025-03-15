// src/core/config-manager.js
// 配置管理器，负责存储和加载配置

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ConfigManager = {
  // 配置文件路径
  CONFIG_DIR: path.join(os.homedir(), '.course-reporter'),
  CONFIG_FILE: path.join(os.homedir(), '.course-reporter', 'config.json'),
  
  // 默认配置
  DEFAULT_CONFIG: {
    apiUrl: 'http://localhost:8080/api', // 默认API服务器地址
    studentId: '', // 学生学号
    name: '', // 学生姓名
    apiVersion: '1.0.0', // API版本
    autoReportInterval: 15 * 60 * 1000, // 默认15分钟
    keyPair: null // 密钥对信息
  },
  
  /**
   * 初始化配置目录
   */
  async initConfigDir() {
    try {
      await fs.mkdir(this.CONFIG_DIR, { recursive: true });
    } catch (error) {
      console.error('创建配置目录失败:', error.message);
      throw error;
    }
  },
  
  /**
   * 加载配置
   * @returns {Promise<Object>} 配置对象
   */
  async loadConfig() {
    try {
      await this.initConfigDir();
      
      try {
        // 尝试读取配置文件
        const data = await fs.readFile(this.CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        
        // 合并配置与默认值 (确保所有字段都存在)
        return { ...this.DEFAULT_CONFIG, ...config };
      } catch (error) {
        // 如果配置文件不存在或格式不正确，返回默认配置
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
          console.log('未找到配置文件，使用默认配置');
          return { ...this.DEFAULT_CONFIG };
        }
        throw error;
      }
    } catch (error) {
      console.error('加载配置失败:', error.message);
      return { ...this.DEFAULT_CONFIG };
    }
  },
  
  /**
   * 保存配置
   * @param {Object} config 要保存的配置对象
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveConfig(config) {
    try {
      await this.initConfigDir();
      
      // 确保配置对象是完整的
      const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
      
      // 写入配置文件
      await fs.writeFile(
        this.CONFIG_FILE,
        JSON.stringify(fullConfig, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('保存配置失败:', error.message);
      return false;
    }
  },
  
  /**
   * 更新部分配置
   * @param {Object} partialConfig 部分配置
   * @returns {Promise<boolean>} 更新是否成功
   */
  async updateConfig(partialConfig) {
    try {
      const currentConfig = await this.loadConfig();
      const updatedConfig = { ...currentConfig, ...partialConfig };
      return await this.saveConfig(updatedConfig);
    } catch (error) {
      console.error('更新配置失败:', error.message);
      return false;
    }
  },
  
  /**
   * 获取密钥路径
   * @returns {Object} 包含公钥和私钥路径的对象
   */
  getKeyPaths() {
    return {
      publicKeyPath: path.join(this.CONFIG_DIR, 'public_key.pem'),
      privateKeyPath: path.join(this.CONFIG_DIR, 'private_key.pem')
    };
  },
  
  /**
   * 删除密钥文件
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteKeyFiles() {
    try {
      const { publicKeyPath, privateKeyPath } = this.getKeyPaths();
      
      try {
        await fs.unlink(publicKeyPath);
      } catch (error) {
        // 如果文件不存在，忽略错误
        if (error.code !== 'ENOENT') throw error;
      }
      
      try {
        await fs.unlink(privateKeyPath);
      } catch (error) {
        // 如果文件不存在，忽略错误
        if (error.code !== 'ENOENT') throw error;
      }
      
      return true;
    } catch (error) {
      console.error('删除密钥文件失败:', error.message);
      return false;
    }
  }
};

export default ConfigManager;