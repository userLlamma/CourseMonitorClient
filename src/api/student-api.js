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

// 测试结果收集器
class TestResults {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.total = 0;
    this.tests = [];
  }

  // 添加测试结果
  addResult(name, passed, message) {
    if(passed) {
      this.passed++;
    } else {
      this.failed++;
    }
    this.total++;
    
    this.tests.push({
      name,
      passed,
      message
    });
  }

  // 获取结果摘要
  getSummary() {
    return {
      passed: this.passed,
      failed: this.failed,
      total: this.total,
      tests: this.tests,
      passRate: this.total ? (this.passed / this.total * 100).toFixed(2) + '%' : '0%',
      score: this.total ? Math.round((this.passed / this.total) * 100) : 0
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
      {
        name: "GET /todos 获取所有待办事项",
        run: async () => {
          const response = await axios.get(`${API_BASE_URL}/todos`);
          if (!Array.isArray(response.data)) {
            throw new Error('响应不是数组格式');
          }
          return { 
            passed: true, 
            message: `成功获取 ${response.data.length} 个待办事项` 
          };
        }
      },
      {
        name: "POST /todos 创建待办事项",
        run: async () => {
          const newTodo = {
            title: `测试待办事项 ${Date.now()}`,
            completed: false
          };
          
          const response = await axios.post(`${API_BASE_URL}/todos`, newTodo);
          
          if (!response.data || !response.data.id || response.data.title !== newTodo.title) {
            throw new Error('创建的待办事项缺少必要字段或数据不匹配');
          }
          
          // 保存ID用于后续测试
          StudentAPI.lastCreatedTodoId = response.data.id;
          
          return { 
            passed: true, 
            message: `成功创建待办事项，ID: ${response.data.id}` 
          };
        }
      },
      {
        name: "GET /todos/:id 获取特定待办事项",
        run: async () => {
          if (!StudentAPI.lastCreatedTodoId) {
            throw new Error('没有可用的待办事项ID，请先创建待办事项');
          }
          
          const response = await axios.get(`${API_BASE_URL}/todos/${StudentAPI.lastCreatedTodoId}`);
          
          if (!response.data || response.data.id !== StudentAPI.lastCreatedTodoId) {
            throw new Error('获取的待办事项ID不匹配');
          }
          
          return { 
            passed: true, 
            message: `成功获取待办事项，ID: ${StudentAPI.lastCreatedTodoId}` 
          };
        }
      },
      {
        name: "PUT /todos/:id 更新待办事项",
        run: async () => {
          if (!StudentAPI.lastCreatedTodoId) {
            throw new Error('没有可用的待办事项ID，请先创建待办事项');
          }
          
          const updateData = {
            title: `更新的待办事项 ${Date.now()}`,
            completed: true
          };
          
          const response = await axios.put(`${API_BASE_URL}/todos/${StudentAPI.lastCreatedTodoId}`, updateData);
          
          if (!response.data || 
              response.data.id !== StudentAPI.lastCreatedTodoId || 
              response.data.title !== updateData.title || 
              response.data.completed !== updateData.completed) {
            throw new Error('更新的待办事项数据不匹配');
          }
          
          return { 
            passed: true, 
            message: `成功更新待办事项，ID: ${StudentAPI.lastCreatedTodoId}` 
          };
        }
      },
      {
        name: "DELETE /todos/:id 删除待办事项",
        run: async () => {
          if (!StudentAPI.lastCreatedTodoId) {
            throw new Error('没有可用的待办事项ID，请先创建待办事项');
          }
          
          await axios.delete(`${API_BASE_URL}/todos/${StudentAPI.lastCreatedTodoId}`);
          
          // 验证删除成功
          try {
            await axios.get(`${API_BASE_URL}/todos/${StudentAPI.lastCreatedTodoId}`);
            throw new Error(`删除失败，仍然可以获取到待办事项，ID: ${StudentAPI.lastCreatedTodoId}`);
          } catch (error) {
            if (error.response && error.response.status === 404) {
              return { 
                passed: true, 
                message: `成功删除待办事项，ID: ${StudentAPI.lastCreatedTodoId}` 
              };
            }
            throw error;
          }
        }
      }
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
        
        try {
          // 使用bind确保this指向StudentAPI
          const result = await test.run.bind(this)();
          results.addResult(test.name, true, result.message);
          console.log(`✅ 通过: ${result.message}`);
        } catch (error) {
          results.addResult(test.name, false, error.message);
          console.log(`❌ 失败: ${error.message}`);
        }
      }
    }
    
    // 打印测试结果摘要
    const summary = results.getSummary();
    console.log(`\n测试完成: ${summary.passed}/${summary.total} 通过 (${summary.passRate})`);
    
    return summary;
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