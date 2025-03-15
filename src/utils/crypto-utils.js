// src/utils/crypto-utils.js
// 加密工具，提供加密相关功能

import crypto from 'crypto';
import fs from 'fs/promises';

export const CryptoUtils = {
  /**
   * 生成RSA密钥对
   * @param {number} modulusLength 密钥长度，默认2048
   * @returns {Object} 包含公钥和私钥的对象
   */
  generateKeyPair(modulusLength = 2048) {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  },
  
  /**
   * 使用私钥签名数据
   * @param {string} data 要签名的数据
   * @param {string} privateKeyPath 私钥文件路径
   * @returns {Promise<string>} 签名（Base64编码）
   */
  async signData(data, privateKeyPath) {
    try {
      // 读取私钥
      const privateKey = await fs.readFile(privateKeyPath, 'utf8');
      
      // 创建签名对象
      const sign = crypto.createSign('SHA256');
      
      // 更新数据
      sign.update(data);
      sign.end();
      
      // 生成签名
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      throw new Error(`签名失败: ${error.message}`);
    }
  },
  
  /**
   * 使用公钥验证签名
   * @param {string} data 原始数据
   * @param {string} signature 签名（Base64编码）
   * @param {string} publicKeyPath 公钥文件路径
   * @returns {Promise<boolean>} 验证结果
   */
  async verifySignature(data, signature, publicKeyPath) {
    try {
      // 读取公钥
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      
      // 创建验证对象
      const verify = crypto.createVerify('SHA256');
      
      // 更新数据
      verify.update(data);
      verify.end();
      
      // 验证签名
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      throw new Error(`验证签名失败: ${error.message}`);
    }
  },
  
  /**
   * 生成随机挑战码
   * @param {number} length 挑战码长度（字节），默认32
   * @returns {string} 十六进制挑战码
   */
  generateChallenge(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  },
  
  /**
   * 计算数据的哈希值
   * @param {string} data 要计算哈希的数据
   * @param {string} algorithm 哈希算法，默认SHA256
   * @returns {string} 十六进制哈希值
   */
  hash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }
};

export default CryptoUtils;