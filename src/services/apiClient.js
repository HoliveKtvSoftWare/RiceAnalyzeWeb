import axios from 'axios'

let _criticalOperationDepth = 0
let _pending401Redirect = false

export function beginCriticalOperation() {
  _criticalOperationDepth++
}

export function endCriticalOperation() {
  _criticalOperationDepth--
  if (_criticalOperationDepth <= 0) {
    _criticalOperationDepth = 0
    if (_pending401Redirect) {
      _pending401Redirect = false
      console.warn('Critical operation finished, redirecting to login due to prior 401.')
      localStorage.removeItem('authToken')
      window.location.href = '/login'
    }
  }
}

function isCriticalOperationActive() {
  return _criticalOperationDepth > 0
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 0,
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response) {
      const status = error.response.status
      console.error(`Error Response Status: ${status}`, error.response.data)
      if (status === 401) {
        if (isCriticalOperationActive()) {
          console.warn('Unauthorized access (401) during critical operation. Deferring redirect until operation finishes.')
          _pending401Redirect = true
          return Promise.reject(error)
        }
        console.warn('Unauthorized access (401). Clearing token and redirecting to login.')
        localStorage.removeItem('authToken')
        window.location.href = '/login'
        return Promise.reject(new Error('Unauthorized: Redirecting to login.'))
      }
    } else if (error.request) {
      console.error('Network Error:', error.message)
    }
    return Promise.reject(error)
  }
)

export default apiClient