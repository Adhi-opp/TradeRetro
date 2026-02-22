import axios from 'axios';

// Ensure this matches your Express server port
const API_URL = 'http://localhost:5000/api'; 

export const executeBacktest = async (payload) => {
    try {
        const response = await axios.post(`${API_URL}/backtest`, payload);
        return response.data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
};