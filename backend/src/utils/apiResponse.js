class ApiResponse {
    constructor(res) {
      this.res = res;
    }
  
    success(statusCode, data = null, message = null) {
      this.res.status(statusCode).json({
        success: true,
        message,
        data
      });
    }
  
    error(statusCode, message) {
      this.res.status(statusCode).json({
        success: false,
        message
      });
    }
  }
  
  // Mude isto:
  // module.exports = ApiResponse;
  
  // Para isto:
  export default ApiResponse;