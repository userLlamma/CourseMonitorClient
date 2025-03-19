#!/usr/bin/env node

/**
 * 课程API状态报告客户端
 * 
 * 这个工具用于向服务器报告学生的API实现状态
 * 支持自动测试、定期报告和远程命令执行
 */

import { program } from 'commander';
import { Commands } from './src/commands/index.js';
import { TestModuleManager } from './src/core/test-module-manager.js';

async function main() {
  // 启动时初始化测试模块状态
  await TestModuleManager.initModuleStatus();

  // 设置命令行界面
  program
    .version('1.0.0')
    .description('课程API实现状态报告工具');

  program
    .command('setup')
    .description('设置报告器配置')
    .action(Commands.setupConfig);

  program
    .command('report')
    .description('单次报告API状态')
    .action(Commands.reportOnce);

  program
    .command('auto')
    .description('启动自动定期报告')
    .option('-i, --interval <minutes>', '报告间隔（分钟）', parseInt)
    .action(Commands.autoReport);

  program
    .command('status')
    .description('显示当前配置和状态')
    .action(Commands.showStatus);

  program
    .command('test')
    .description('只运行API测试，不发送报告')
    .action(Commands.runTestsOnly);

  program
    .command('modules')
    .description('显示测试模块状态')
    .action(Commands.showModules);

  // 处理命令行参数
  if (process.argv.length > 2) {
    program.parse(process.argv);
  } else {
    program.help();
  }
}

// 运行主函数
main().catch(error => {
  console.error('程序启动失败:', error);
  process.exit(1);
});

// 导出模块的公共API
export default {
  setup: Commands.setupConfig,
  report: Commands.reportOnce,
  auto: Commands.autoReport,
  status: Commands.showStatus,
  test: Commands.runTestsOnly,
  modules: Commands.showModules
};