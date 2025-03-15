// src/commands/index.js
// 命令实现集合

import { ConfigManager } from '../core/config-manager.js';
import { ReporterCore } from '../core/reporter-core.js';
import { TestModuleManager } from '../core/test-module-manager.js';
import { CommandHandler } from '../core/command-handler.js';
import inquirer from 'inquirer';

export const Commands = {
  // 设置配置
  async setupConfig() {
    try {
      console.log('===== 课程API报告工具配置 =====');
      
      // 加载现有配置
      const config = await ConfigManager.loadConfig();
      
      // 提示用户输入配置
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiUrl',
          message: '请输入汇报API服务器地址:',
          default: config.apiUrl
        },
        {
          type: 'input',
          name: 'studentId',
          message: '请输入你的学号:',
          default: config.studentId,
          validate: input => input.trim() !== '' || '学号不能为空'
        },
        {
          type: 'input',
          name: 'name',
          message: '请输入你的姓名:',
          default: config.name,
          validate: input => input.trim() !== '' || '姓名不能为空'
        },
        {
          type: 'input',
          name: 'autoReportInterval',
          message: '自动报告间隔（分钟）:',
          default: config.autoReportInterval / 60000,
          validate: input => !isNaN(parseInt(input)) && parseInt(input) > 0 || '请输入有效的分钟数',
          filter: input => parseInt(input) * 60000
        }
      ]);
      
      // 更新配置
      const newConfig = { ...config, ...answers };
      
      // 检查是否需要生成密钥对
      if (!newConfig.keyPair) {
        console.log('您需要生成密钥对以进行安全认证。');
        await ReporterCore.generateAndSaveKeyPair(newConfig);
      }
      
      // 保存配置
      await ConfigManager.saveConfig(newConfig);
      console.log('配置已保存');
      
      // 提示完成报告
      if (newConfig.studentId) {
        const { report } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'report',
            message: '是否立即进行一次状态报告?',
            default: true
          }
        ]);
        
        if (report) {
            await Commands.reportOnce();
        }
      }
      
    } catch (error) {
      console.error('配置过程中出错:', error.message);
    }
  },
  
  // 单次报告
  async reportOnce() {
    try {
      // 加载配置
      const config = await ConfigManager.loadConfig();
      
      if (!config.studentId) {
        console.log('请先设置学号');
        await Commands.setupConfig();
        return;
      }
      
      console.log(`===== 开始报告 (${config.studentId}) =====`);
      
      // 执行认证
      let authData;
      try {
        authData = await ReporterCore.authenticate(config);
      } catch (authError) {
        // 处理认证错误
        if (authError.response?.data?.requiresReregistration) {
          console.log('教师已重置您的密钥，需要重新注册');
          // 删除旧密钥配置
          config.keyPair = null;
          await ConfigManager.saveConfig(config);
          // 生成新密钥
          await ReporterCore.generateAndSaveKeyPair(config);
          // 重试认证
          authData = await ReporterCore.authenticate(config);
        } else if (authError.message.includes('未找到密钥对') || 
                  authError.message.includes('私钥文件不存在')) {
          console.log('密钥不存在或已损坏，正在重新生成...');
          await ReporterCore.generateAndSaveKeyPair(config);
          authData = await ReporterCore.authenticate(config);
        } else {
          throw authError;
        }
      }
      
      // 创建报告数据
      const reportData = await ReporterCore.createReportData(config, authData);
      
      // 发送报告
      console.log('发送API状态报告...');
      const response = await ReporterCore.sendReport(config, reportData);
      
      console.log('报告成功!', response.message || '');
      
      // 处理服务器命令
      if (response.command) {
        await CommandHandler.handleServerCommands(response);
      }
      
      return response;
      
    } catch (error) {
      if (error.response?.data?.requiresAuth) {
        console.error('认证失败:', error.response.data.error);
        
        // 重新配置认证信息
        const { reconfigure } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'reconfigure',
            message: '是否重新生成密钥?',
            default: true
          }
        ]);
        
        if (reconfigure) {
          const config = await ConfigManager.loadConfig();
          config.keyPair = null;
          await ConfigManager.saveConfig(config);
          await ReporterCore.generateAndSaveKeyPair(config);
          return await Commands.reportOnce();
        }
      } else {
        console.error('报告失败:', error.response?.data?.error || error.message);
      }
    }
  },
  
  // 自动定期报告
  async autoReport(options) {
    try {
      // 加载配置
      const config = await ConfigManager.loadConfig();
      
      // 更新报告间隔（如果指定）
      if (options.interval) {
        config.autoReportInterval = options.interval * 60000;
        await ConfigManager.saveConfig(config);
      }
      
      const intervalMinutes = config.autoReportInterval / 60000;
      console.log(`启动自动报告，间隔: ${intervalMinutes} 分钟`);
      
      // 首次立即报告 - 使用 Commands 而不是 this
      await Commands.reportOnce();
      
      // 设置定期报告 - 使用 Commands 而不是 this
      const intervalId = setInterval(async () => {
        try {
          await Commands.reportOnce();
        } catch (error) {
          console.error('自动报告失败:', error.message);
        }
      }, config.autoReportInterval);
      
      console.log('自动报告已启动，按 Ctrl+C 停止');
      
      // 监听退出信号
      process.on('SIGINT', () => {
        clearInterval(intervalId);
        console.log('\n自动报告已停止');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('启动自动报告失败:', error.message);
    }
  },
  
  // 显示当前状态
  async showStatus() {
    try {
      // 加载配置
      const config = await ConfigManager.loadConfig();
      
      console.log('===== 当前配置状态 =====');
      console.log('API服务器:', config.apiUrl);
      console.log('学号:', config.studentId || '未设置');
      console.log('姓名:', config.name || '未设置');
      console.log('自动报告间隔:', `${config.autoReportInterval / 60000} 分钟`);
      
      if (config.keyPair) {
        console.log('\n密钥信息:');
        console.log('设备名称:', config.keyPair.name);
        console.log('创建时间:', config.keyPair.created);
        console.log('公钥文件:', config.keyPair.publicKeyFile);
        console.log('私钥文件:', config.keyPair.privateKeyFile);
      } else {
        console.log('\n未配置密钥对，请运行 setup 命令进行配置');
      }
      
      // 显示测试模块状态 - 使用 Commands 而不是 this
      await Commands.showModules();
      
    } catch (error) {
      console.error('获取状态失败:', error.message);
    }
  },
  
  // 只运行测试，不发送报告
  async runTestsOnly() {
    try {
      console.log('===== 执行API测试 =====');
      await CommandHandler.runTests();
    } catch (error) {
      console.error('执行测试失败:', error.message);
    }
  },
  
  // 显示测试模块状态
  async showModules() {
    try {
      console.log('\n===== 测试模块状态 =====');
      
      // 获取测试模块配置
      const moduleConfig = await TestModuleManager.getModulesConfig();
      
      // 获取测试模块状态
      const { default: StudentAPI } = await import('../api/student-api.js');
      const modulesStatus = StudentAPI.getTestModulesStatus();
      
      console.log('\n可用测试模块:');
      for (const [moduleId, status] of Object.entries(modulesStatus)) {
        const active = moduleConfig[moduleId]?.active ?? status.active;
        console.log(`- ${moduleId}: ${status.name}`);
        console.log(`  描述: ${status.description}`);
        console.log(`  状态: ${active ? '激活' : '未激活'}`);
        console.log(`  测试数: ${status.testCount}\n`);
      }
      
    } catch (error) {
      console.error('获取测试模块状态失败:', error.message);
    }
  }
};

export default Commands;