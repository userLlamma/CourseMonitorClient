// src/core/command-handler.js
// 处理服务器发送的命令

import { TestModuleManager } from './test-module-manager.js';

export const CommandHandler = {
  /**
   * 处理服务器命令
   * @param {Object} response 服务器响应
   * @returns {Promise<boolean>} 命令处理结果
   */
  async handleServerCommands(response) {
    if (!response) return false;
    
    // 提取命令和参数
    const command = response.command;
    const params = response.params || {};
    
    if (!command) return false;
    
    console.log(`收到服务器命令: ${command}`);
    
    try {
      // 处理测试模块激活命令
      if (command === 'ACTIVATE_MODULE') {
        return await TestModuleManager.handleModuleCommand(command, params);
      }
      
      // 处理内置命令
      if (command === 'RUN_TEST') {
        return await this.runTests();
      }

      if (command === 'CLEAN_DATA') {
        return await this.cleanData();
      }
      
      // 处理重置密钥命令
      if (command === 'RESET_KEYS') {
        console.log('执行重置密钥命令...');
        // 删除本地密钥配置
        const config = await ConfigManager.loadConfig();
        config.keyPair = null;
        await ConfigManager.saveConfig(config);
        await ConfigManager.deleteKeyFiles();
        console.log('密钥已重置，将在下次报告时重新生成');
        return true;
      }
      
      // 未知命令
      console.log(`未知命令: ${command}`);
      return false;
    } catch (error) {
      console.error(`处理命令 ${command} 失败:`, error.message);
      return false;
    }
  },
  
  /**
   * 运行测试
   * @returns {Promise<boolean>} 测试结果
   */
  async runTests() {
    try {
      console.log('执行测试命令...');
      
      // 动态导入学生API
      const { default: StudentAPI } = await import('../api/student-api.js');
      
      // 运行测试
      const results = await StudentAPI.runCustomTests();
      
      console.log(`测试完成: ${results.passed}/${results.total} 通过`);
      return true;
    } catch (error) {
      console.error('运行测试失败:', error.message);
      return false;
    }
  },
  
  /**
   * 清理数据
   * @returns {Promise<boolean>} 清理结果
   */
  async cleanData() {
    try {
      console.log('执行数据清理命令...');
      
      // 动态导入学生API
      const { default: StudentAPI } = await import('../api/student-api.js');
      
      // 清理数据
      const result = await StudentAPI.cleanData();
      
      if (result.success) {
        console.log(result.message);
        return true;
      } else {
        console.error('清理数据失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('清理数据失败:', error.message);
      return false;
    }
  }
};

export default CommandHandler;