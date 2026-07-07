import axios from 'axios'

const BASE = '/api'

export const getExpenses  = ()       => axios.get(`${BASE}/expenses`)
export const createExpense = (data)  => axios.post(`${BASE}/expenses`, data)
export const updateExpense = (id, d) => axios.put(`${BASE}/expenses/${id}`, d)
export const deleteExpense = (id)    => axios.delete(`${BASE}/expenses/${id}`)
export const getStats      = ()      => axios.get(`${BASE}/stats`)
