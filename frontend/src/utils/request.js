import axios from 'axios';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';

export const isCancel = axios.isCancel;

export const getErrorMessage = (error, fallback = 'Terjadi kesalahan, silakan coba lagi') => {
  if (error?.code === 'ERR_NETWORK') return 'Tidak dapat terhubung ke server';
  if (error?.code === 'ECONNABORTED') return 'Permintaan terlalu lama, coba lagi';
  return error?.response?.data?.message || error?.message || fallback;
};

export const getFieldErrors = (error) => error?.response?.data?.errors || {};

export const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const getList = async (endpoint, params = {}, signal) => {
  const { data } = await api.get(endpoint, { params: cleanParams(params), signal });
  return data;
};

export const createData = async (endpoint, payload) => (await api.post(endpoint, payload)).data;
export const updateData = async (endpoint, payload) => (await api.put(endpoint, payload)).data;
export const removeData = async (endpoint) => (await api.delete(endpoint)).data;

export const downloadFile = async (endpoint, params, filename) => {
  const { data } = await api.get(endpoint, { params: cleanParams(params), responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(API_ENDPOINTS.UPLOADS.IMAGE, formData);
  return data.data.path;
};

export const uploadSignature = async (dataUrl) => {
  const { data } = await api.post(API_ENDPOINTS.UPLOADS.SIGNATURE, { data: dataUrl });
  return data.data.path;
};
