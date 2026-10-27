import { io } from 'socket.io-client'

export const socketClient = io({
  autoConnect: false,
  transports: ['websocket'],
})

export const connectSocket = () => {
  if (!socketClient.connected) {
    socketClient.connect()
  }
}

export const disconnectSocket = () => {
  if (socketClient.connected) {
    socketClient.disconnect()
  }
}

export const subscribePriceUpdate = (handler: (payload: { id: string; newPrice: string }) => void) => {
  socketClient.on('nft.updated', handler)
  return () => socketClient.off('nft.updated', handler)
}
