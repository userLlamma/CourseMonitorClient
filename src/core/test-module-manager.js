// src/core/test-module-manager.js
// 远程测试模块管理，允许教师远程启用/禁用测试模块

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试模块管理器
export const TestModuleManager = {
  // 配置路径
  CONFIG_DIR: path.join(os.homedir(), '.course-reporter'),
  MODULES_CONFIG_FILE: path.join(os.homedir(), '.course-reporter', 'test-modules.json'),
  
  // 默认模块配置
  DEFAULT_MODULES: {
    basicTodos: { active: true },
    todoFilters: { active: true },
    userManagement: { active: false },
    // 可扩展：根据课程进度添加更多模块
  },
  
  // 初始化测试模块配置
  async init() {
    try {
      // 确保目录存在
      await fs.mkdir(this.CONFIG_DIR, { recursive: true });
      
      // 检查模块配置文件是否存在
      try {
        await fs.access(this.MODULES_CONFIG_FILE);
      } catch (error) {
        // 如果不存在，创建默认配置
        await fs.writeFile(
          this.MODULES_CONFIG_FILE, 
          JSON.stringify(this.DEFAULT_MODULES, null, 2)
        );
      }
    } catch (error) {
      console.error('初始化测试模块配置失败:', error.message);
    }
  },
  
  // 读取测试模块配置
  async getModulesConfig() {
    try {
      await this.init();
      
      const data = await fs.readFile(this.MODULES_CONFIG_FILE, 'utf8');
      return { ...this.DEFAULT_MODULES, ...JSON.parse(data) };
    } catch (error) {
      console.error('读取测试模块配置失败:', error.message);
      return { ...this.DEFAULT_MODULES };
    }
  },
  
  // 更新测试模块配置
  async updateModulesConfig(newConfig) {
    try {
      await this.init();
      
      const currentConfig = await this.getModulesConfig();
      const updatedConfig = { ...currentConfig, ...newConfig };
      
      await fs.writeFile(
        this.MODULES_CONFIG_FILE, 
        JSON.stringify(updatedConfig, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('更新测试模块配置失败:', error.message);
      return false;
    }
  },
  
  // 处理服务器模块激活指令
  async handleModuleCommand(command, params) {
    if (command !== 'ACTIVATE_MODULE') return false;
    
    try {
      const { moduleId, active } = params;
      
      if (!moduleId) {
        throw new Error('缺少moduleId参数');
      }
      
      const moduleConfig = {};
      moduleConfig[moduleId] = { active: active !== false };
      
      const success = await this.updateModulesConfig(moduleConfig);
      
      if (success) {
        console.log(`成功${moduleConfig[moduleId].active ? '激活' : '停用'}测试模块: ${moduleId}`);
        
        // 动态更新当前测试模块状态
        try {
          const { default: StudentAPI } = await import('../api/student-api.js');
          StudentAPI.activateTestModule(moduleId, moduleConfig[moduleId].active);
        } catch (error) {
          console.error('更新测试模块状态失败:', error.message);
        }
      }
      
      return success;
    } catch (error) {
      console.error('处理模块命令失败:', error.message);
      return false;
    }
  },
  
  // 初始化模块状态 (在报告器启动时调用)
  async initModuleStatus() {
    try {
      const config = await this.getModulesConfig();
      
      // 动态更新所有测试模块状态
      try {
        const { default: StudentAPI } = await import('../api/student-api.js');
        
        for (const [moduleId, moduleConfig] of Object.entries(config)) {
          StudentAPI.activateTestModule(moduleId, moduleConfig.active);
        }
        
        console.log('已初始化测试模块状态');
      } catch (error) {
        console.error('初始化测试模块状态失败:', error.message);
      }
      
      return true;
    } catch (error) {
      console.error('初始化模块状态失败:', error.message);
      return false;
    }
  }
};

export default TestModuleManager;