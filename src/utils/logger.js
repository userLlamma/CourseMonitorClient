// src/utils/logger.js
// 日志工具，提供统一的日志记录功能

import { createLogger, format, transports } from 'winston';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

// 日志文件目录
const LOG_DIR = path.join(os.homedir(), '.course-reporter', 'logs');

// 确保日志目录存在
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('创建日志目录失败:', error.message);
  }
}

// 创建Winston日志记录器
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'course-reporter' },
  transports: [
    // 控制台输出
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    }),
    // 文件输出 - 所有日志
    new transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // 文件输出 - 错误日志
    new transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// 扩展的日志工具
export const Logger = {
  // 确保日志目录
  async init() {
    await ensureLogDir();
  },
  
  // 记录信息日志
  info(message, meta = {}) {
    logger.info(message, meta);
  },
  
  // 记录警告日志
  warn(message, meta = {}) {
    logger.warn(message, meta);
  },
  
  // 记录错误日志
  error(message, error = null, meta = {}) {
    if (error) {
      meta.error = error.message;
      meta.stack = error.stack;
    }
    logger.error(message, meta);
  },
  
  // 记录调试日志
  debug(message, meta = {}) {
    logger.debug(message, meta);
  },
  
  // 记录API测试结果
  logTestResult(result) {
    logger.info(`API测试结果: ${result.passed}/${result.total} 通过 (${result.passRate})`, {
      testResult: result
    });
  },
  
  // 记录报告发送结果
  logReportSent(studentId, response) {
    logger.info(`报告发送成功: ${studentId}`, {
      studentId,
      response
    });
  },
  
  // 获取日志文件路径
  getLogFilePaths() {
    return {
      combined: path.join(LOG_DIR, 'combined.log'),
      error: path.join(LOG_DIR, 'error.log')
    };
  }
};

// 初始化日志
Logger.init();

export default Logger;