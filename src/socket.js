import { io } from 'socket.io-client'

export const connectSocket = (tokenKey = 'sa_teacher_token') => {
  const token = localStorage.getItem(tokenKey)

  return io('http://localhost:3000', {
    auth: { token },
    transports: ['websocket'],
  })
}