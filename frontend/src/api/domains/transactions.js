import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';

export const transactionsApi = {
  sendTransactions: async (transactionIds, isSending = true) => fetchJSON(endpoints.sendTransactions.path, {
    method: 'POST',
    body: JSON.stringify({ transactionIds, isSending }),
  }),
};