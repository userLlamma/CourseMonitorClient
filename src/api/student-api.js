// src/api/student-api.js
// 可扩展的API测试框架

/**
 * 学生API测试框架
 * 
 * 这个文件包含测试学生API实现的框架
 * 设计为易于扩展，随着课程进度可添加新的API测试
 */

import axios from 'axios';

// 默认的API基础URL
const API_BASE_URL = 'http://localhost:3000';

/**
   * 截断响应数据以控制大小
   * @param {Object} response Axios响应对象
   * @param {number} maxLength 字符串字段最大长度
   * @param {number} maxArrayItems 数组最大项数
   * @returns {Object} 截断后的响应对象
   */
function truncateResponseData(response, maxLength = 5000, maxArrayItems = 100) {
  if (!response) return response;
  
  // 创建新对象以避免修改原始响应
  const truncated = {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers ? { ...response.headers } : undefined,
    data: undefined
  };
  
  // 递归处理对象和数组，截断过长字段
  function truncateValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    
    // 处理字符串 - 截断过长字符串
    if (typeof value === 'string') {
      if (value.length > maxLength) {
        return value.substring(0, maxLength) + `... (原长度: ${value.length})`;
      }
      return value;
    }
    
    // 处理数组 - 限制项数并递归处理每一项
    if (Array.isArray(value)) {
      const truncatedArray = value.slice(0, maxArrayItems).map(truncateValue);
      if (value.length > maxArrayItems) {
        truncatedArray.push(`... (另外还有 ${value.length - maxArrayItems} 项)"`);
      }
      return truncatedArray;
    }
    
    // 处理对象 - 递归处理每个属性
    if (typeof value === 'object') {
      const truncatedObj = {};
      for (const [key, propValue] of Object.entries(value)) {
        truncatedObj[key] = truncateValue(propValue);
      }
      return truncatedObj;
    }
    
    // 其他类型直接返回
    return value;
  }
  
  // 处理响应数据
  truncated.data = truncateValue(response.data);
  
  return truncated;
}

// 测试结果收集器
class TestResults {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.total = 0;
    this.tests = [];
  }

  // 添加测试结果
  addResult(name, passed, message, testData = {}) {
    if(passed) {
      this.passed++;
    } else {
      this.failed++;
    }
    this.total++;
    
    this.tests.push({
      name,
      passed,
      message,
      ...testData
    });
  }

  // 获取结果摘要
  getSummary() {
    const passed = this.passed || 0;
    const total = this.total || 0;
    const failed = this.failed || 0;
    
    return {
      passed,
      failed,
      total,
      tests: this.tests,
      passRate: total ? (passed / total * 100).toFixed(2) + '%' : '0%',
      score: total ? Math.round((passed / total) * 100) : 0,
      maxPossibleScore: total * 10,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * API测试集合 - 按课程模块组织
 * 
 * 每个测试模块都是一个对象，包含测试名称和测试函数
 * 随着课程进度，可以方便地添加新的测试模块
 */
const TestModules = {
  // 模块1: 基础待办事项CRUD操作
  basicTodos: {
    name: "基础待办事项CRUD操作",
    description: "测试基本的待办事项创建、读取、更新和删除功能",
    active: true, // 是否激活此测试模块
    tests: [
      // 获取所有待办事项测试
      {
        name: "GET /todos 获取所有待办事项",
        run: async () => {
          const response = await axios.get(`${API_BASE_URL}/todos`);
          
          // 验证响应
          if (!Array.isArray(response.data)) {
            throw new Error('响应不是数组格式');
          }
          
          // 直接在响应对象上添加消息属性
          response.message = `成功获取 ${response.data.length} 个待办事项`;
          
          // 直接返回完整的响应对象
          return response;
        }
      },

      // 创建待办事项测试
      {
        name: "POST /todos 创建待办事项",
        run: async () => {
          const newTodo = {
            title: `测试待办事项 ${Date.now()}`,
            completed: false
          };
          
          const response = await axios.post(`${API_BASE_URL}/todos`, newTodo);
          
          // 验证响应
          if (!response.data || !response.data.id || response.data.title !== newTodo.title) {
            throw new Error('创建的待办事项缺少必要字段或数据不匹配');
          }
          
          // 保存ID用于后续测试
          StudentAPI.lastCreatedTodoId = response.data.id;
          
          // 在响应对象上添加消息和请求信息
          response.message = `成功创建待办事项，ID: ${response.data.id}`;
          response.requestData = {
            method: 'POST',
            url: `${API_BASE_URL}/todos`,
            body: newTodo
          };
          
          // 返回完整响应
          return response;
        }
      },

      // 获取特定待办事项测试
      {
        name: "GET /todos/:id 获取特定待办事项",
        run: async () => {
          if (!StudentAPI.lastCreatedTodoId) {
            throw new Error('没有可用的待办事项ID，请先创建待办事项');
          }
          
          const response = await axios.get(`${API_BASE_URL}/todos/${StudentAPI.lastCreatedTodoId}`);
          
          // 验证响应
          if (!response.data || response.data.id !== StudentAPI.lastCreatedTodoId) {
            throw new Error('获取的待办事项ID不匹配');
          }
          
          // 添加消息
          response.message = `成功获取待办事项，ID: ${StudentAPI.lastCreatedTodoId}`;
          
          // 直接返回响应
          return response;
        }
      },
    ]
  },
  
  // 模块2: 待办事项过滤和查询
  todoFilters: {
    name: "待办事项过滤和查询",
    description: "测试待办事项的过滤和查询功能",
    active: true,
    tests: [
      {
        name: "GET /todos?completed=true 过滤已完成待办事项",
        run: async () => {
          // 首先创建一个已完成的待办事项
          const completedTodo = {
            title: `已完成待办事项 ${Date.now()}`,
            completed: true
          };
          
          await axios.post(`${API_BASE_URL}/todos`, completedTodo);
          
          // 测试过滤
          const response = await axios.get(`${API_BASE_URL}/todos?completed=true`);
          
          if (!Array.isArray(response.data)) {
            throw new Error('响应不是数组格式');
          }
          
          if (response.data.length === 0) {
            throw new Error('没有找到已完成的待办事项');
          }
          
          if (!response.data.every(todo => todo.completed === true)) {
            throw new Error('存在未完成的待办事项在结果中');
          }
          
          return { 
            passed: true, 
            message: `成功过滤 ${response.data.length} 个已完成待办事项` 
          };
        }
      },
      {
        name: "GET /todos?completed=false 过滤未完成待办事项",
        run: async () => {
          // 首先创建一个未完成的待办事项
          const incompleteTodo = {
            title: `未完成待办事项 ${Date.now()}`,
            completed: false
          };
          
          await axios.post(`${API_BASE_URL}/todos`, incompleteTodo);
          
          // 测试过滤
          const response = await axios.get(`${API_BASE_URL}/todos?completed=false`);
          
          if (!Array.isArray(response.data)) {
            throw new Error('响应不是数组格式');
          }
          
          if (response.data.length === 0) {
            throw new Error('没有找到未完成的待办事项');
          }
          
          if (!response.data.every(todo => todo.completed === false)) {
            throw new Error('存在已完成的待办事项在结果中');
          }
          
          return { 
            passed: true, 
            message: `成功过滤 ${response.data.length} 个未完成待办事项` 
          };
        }
      }
    ]
  },
  
  // 模块3: 用户管理API
  userManagement: {
    name: "用户管理API",
    description: "测试用户注册、登录和管理功能",
    active: false, // 未激活，等待后续课程开启
    tests: [
      {
        name: "POST /users/register 注册用户",
        run: async () => {
          // 实现将在后续课程中添加
          throw new Error("此测试尚未实现");
        }
      },
      {
        name: "POST /users/login 用户登录",
        run: async () => {
          // 实现将在后续课程中添加
          throw new Error("此测试尚未实现");
        }
      }
    ]
  },
  
  // 可扩展：根据课程进度添加更多测试模块
};

/**
 * 学生API接口
 */
export const StudentAPI = {
  // API基础URL
  API_BASE_URL,
  
  // 测试状态追踪
  lastCreatedTodoId: null,
  
  /**
   * 运行所有激活的测试模块
   * 当服务器发送RUN_TEST命令时会调用这个函数
   * 
   * @returns {Promise<Object>} 测试结果
   */
  async runCustomTests() {
    console.log('开始执行API测试...');
    
    const results = new TestResults();
    this.lastCreatedTodoId = null;
    
    // 遍历所有激活的测试模块
    for (const [moduleId, module] of Object.entries(TestModules)) {
      if (!module.active) continue;
      
      console.log(`\n测试模块: ${module.name}`);
      console.log(module.description);
      
      // 运行模块中的所有测试
      for (const test of module.tests) {
        console.log(`\n运行测试: ${test.name}`);
        
        // 解析测试名称以获取方法和端点
        const parts = test.name.split(' ');
        const method = parts[0] || "未知方法";
        const endpoint = parts.slice(1).join(' ') || "未知端点";
        
        try {
          // 跟踪请求开始时间
          const startTime = Date.now();
          
          // 使用bind确保this指向StudentAPI
          const result = await test.run.bind(this)();
          
          // 计算请求耗时
          const duration = Date.now() - startTime;
          
          // 确保响应有正确的格式，并截断过大的数据
          let responseData = {};
          
          // 如果测试函数直接返回了axios响应，则使用它
          if (result && result.status && result.data) {
            responseData = truncateResponseData(result);
          } 
          // 如果测试返回了自定义格式的结果，提取响应数据
          else if (result && result.data) {
            responseData = truncateResponseData(result.data);
          }
          // 测试返回了自己的格式，直接使用
          else {
            responseData = result;
          }
          
          // 成功的测试结果
          const testData = {
            name: test.name,
            endpoint,
            method,
            passed: true,
            duration,
            // 保存完整的响应数据
            response: responseData,
            error: null,
            score: {
              value: 10, // 通过的测试得10分
              maxValue: 10,
              comments: result.message || "通过测试"
            }
          };
          
          results.addResult(test.name, true, result.message || "测试通过", testData);
          console.log(`✅ 通过: ${result.message || "测试通过"} (${duration}ms)`);
        } catch (error) {
          // 获取错误信息
          let errorMessage = error.message;
          let responseData = {};
          
          // 尝试从Axios错误中提取响应数据
          if (error.response) {
            responseData = truncateResponseData(error.response);
            // 增强错误信息
            if (!errorMessage.includes(error.response.status.toString())) {
              errorMessage = `[${error.response.status}] ${errorMessage}`;
            }
          } else if (error.request) {
            // 请求已经发出，但没有收到响应
            responseData = {
              request: true,
              message: "No response received"
            };
          }
          
          // 如果错误对象自带响应数据，使用它
          if (error.responseData) {
            responseData = truncateResponseData(error.responseData);
          }
          
          // 失败的测试结果
          const testData = {
            name: test.name,
            endpoint,
            method,
            passed: false,
            // 保存响应数据，即使是错误响应
            response: responseData,
            error: errorMessage,
            score: {
              value: 0, // 失败的测试得0分
              maxValue: 10,
              comments: errorMessage || "测试失败"
            }
          };
          
          results.addResult(test.name, false, errorMessage, testData);
          console.log(`❌ 失败: ${errorMessage}`);
        }
      }
    }
    
    // 打印测试结果摘要
    const summary = results.getSummary();
    console.log(`\n测试完成: ${summary.passed}/${summary.total} 通过 (${summary.passRate})`);
    
    // 保存最新的测试结果，确保格式符合前端期望
    this.lastTestResults = {
      score: summary.score,
      maxPossibleScore: summary.maxPossibleScore,
      totalPassed: summary.passed,
      totalFailed: summary.failed,
      timestamp: summary.timestamp,
      tests: summary.tests.map(test => ({
        name: test.name,
        endpoint: test.endpoint,
        method: test.method,
        passed: test.passed,
        // 直接使用测试中保存的响应数据
        response: test.response || {},
        error: test.passed ? null : test.error,
        score: {
          value: test.passed ? 10 : 0,
          maxValue: 10,
          comments: test.passed ? (test.message || "通过测试") : test.error
        }
      }))
    };
    
    // 添加调试输出
    // console.log('\n测试结果响应数据样例:');
    // if (this.lastTestResults.tests.length > 0) {
    //   const firstTest = this.lastTestResults.tests[0];
    //   console.log(`测试 "${firstTest.name}" 的响应数据类型:`, typeof firstTest.response);
    //   console.log(JSON.stringify(firstTest.response, null, 2).substring(0, 5000) + (JSON.stringify(firstTest.response, null, 2).length > 5000 ? '...' : ''));
    // }
    
    console.log('\n测试结果详细数据:');
    console.log(JSON.stringify(this.lastTestResults, null, 2));
    return this.lastTestResults;
  },
  
  /**
   * 清理数据
   * 当服务器发送CLEAN_DATA命令时会调用这个函数
   * 
   * @returns {Promise<Object>} 清理结果
   */
  async cleanData() {
    console.log('开始清理数据...');
    
    try {
      // 获取所有待办事项
      const response = await axios.get(`${API_BASE_URL}/todos`);
      const todos = response.data;
      
      console.log(`找到 ${todos.length} 个待办事项需要删除`);
      
      // 删除所有待办事项
      for (const todo of todos) {
        await axios.delete(`${API_BASE_URL}/todos/${todo.id}`);
        console.log(`已删除待办事项 ID: ${todo.id}`);
      }
      
      return { 
        success: true, 
        message: `成功清理 ${todos.length} 个待办事项` 
      };
    } catch (error) {
      console.error('清理数据失败:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  },
  
  /**
   * 激活测试模块
   * 用于在课程进度中开启新的测试模块
   * 
   * @param {string} moduleId 模块ID
   * @param {boolean} active 是否激活
   */
  activateTestModule(moduleId, active = true) {
    if (TestModules[moduleId]) {
      TestModules[moduleId].active = active;
      console.log(`${active ? '激活' : '停用'}测试模块: ${TestModules[moduleId].name}`);
      return true;
    }
    console.log(`未找到测试模块: ${moduleId}`);
    return false;
  },
  
  /**
   * 获取所有测试模块状态
   * 
   * @returns {Object} 测试模块状态
   */
  getTestModulesStatus() {
    const status = {};
    
    for (const [moduleId, module] of Object.entries(TestModules)) {
      status[moduleId] = {
        name: module.name,
        description: module.description,
        active: module.active,
        testCount: module.tests.length
      };
    }
    
    return status;
  }
};

export default StudentAPI;