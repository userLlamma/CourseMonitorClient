// src/utils/hardware-info.js
// 硬件信息收集工具

import os from 'os';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import si from 'systeminformation';

export const HardwareInfo = {
  /**
   * 收集系统硬件信息
   * @returns {Promise<Object>} 硬件信息对象
   */
  async collect() {
    try {
      console.log('收集硬件信息...');
      
      // 基础系统信息
      const platform = os.platform();
      const hostname = os.hostname();
      const username = os.userInfo().username;
      const totalMemory = os.totalmem();
      
      // CPU信息
      const cpuInfo = await si.cpu();
      const cpuModel = cpuInfo.brand;
      const cpuCores = cpuInfo.cores;
      const cpuSpeed = cpuInfo.speed;
      
      // 网络接口
      const networkInterfaces = os.networkInterfaces();
      const macAddresses = [];
      
      // 提取MAC地址
      Object.keys(networkInterfaces).forEach(ifName => {
        networkInterfaces[ifName].forEach(iface => {
          if (iface.family === 'IPv4' && !iface.internal) {
            macAddresses.push(iface.mac);
          }
        });
      });
      
      // 磁盘信息
      const disks = await si.diskLayout();
      const diskLayout = disks.map(disk => ({
        type: disk.type,
        size: disk.size,
        serialNum: disk.serialNum
      }));
      
      // 尝试获取设备ID
      let deviceId;
      try {
        deviceId = machineIdSync();
      } catch (error) {
        console.warn('无法获取机器ID:', error.message);
        deviceId = 'unknown';
      }
      
      // 尝试获取BIOS信息
      let biosSerial = 'unknown';
      try {
        const bios = await si.bios();
        biosSerial = bios.serial || 'unknown';
      } catch (error) {
        console.warn('无法获取BIOS信息:', error.message);
      }
      
      // 尝试获取显示信息
      let displayResolution = 'unknown';
      try {
        const graphics = await si.graphics();
        if (graphics.displays && graphics.displays.length > 0) {
          displayResolution = `${graphics.displays[0].resolutionX}x${graphics.displays[0].resolutionY}`;
        }
      } catch (error) {
        console.warn('无法获取显示信息:', error.message);
      }
      
      // 时区信息
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // 浏览器指纹 (Node.js环境下使用通用值)
      const userAgent = `Node.js ${process.version} (${platform})`;
      
      // 组合硬件信息
      return {
        cpuModel,
        cpuCores,
        cpuSpeed,
        totalMemory,
        platform,
        hostname,
        username,
        macAddresses,
        deviceId,
        biosSerial,
        displayResolution,
        timezone,
        diskLayout,
        userAgent
      };
    } catch (error) {
      console.error('收集硬件信息失败:', error.message);
      // 返回基本信息
      return {
        platform: os.platform(),
        hostname: os.hostname(),
        username: os.userInfo().username,
        totalMemory: os.totalmem(),
        cpuModel: 'unknown',
        cpuCores: os.cpus().length,
        macAddresses: []
      };
    }
  }
};

export default HardwareInfo;