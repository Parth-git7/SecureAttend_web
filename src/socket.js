import { io } from 'socket.io-client'

export const connectSocket = (tokenKey = 'sa_token') => {
  const url = typeof window !== 'undefined' ? window.location.origin : ''

  return io(url, {
    auth: (cb) => {
      cb({ token: localStorage.getItem(tokenKey) })
    },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  })
}