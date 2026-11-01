import apiClient from './apiClient'; 

const login = (email, password) => {
  const formData = new FormData();
  formData.append('username', email); 
  formData.append('password', password);
  formData.append('grant_type', 'password'); 

  return apiClient.post('/auth/jwt/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }).then(response => response.data); 
};

const register = (userData) => {
  return apiClient.post('/auth/register', {
    email: userData.email,
    password: userData.password,
  }).then(response => response.data); 
};

const getUserProfile = () => {
  console.debug('Fetching user profile...');
  return apiClient.get('/users/me')
    .then(response => {
      console.debug('User profile fetched:', response.data);
      return response.data; 
    })
    .catch(error => {
      console.error('Failed to fetch user profile:', error.response?.data || error.message);
      throw error;
    });
};

export const authService = {
  login,
  register,
  getUserProfile
};