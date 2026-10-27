import type { Nft, User } from '../types'

const collections = ['Nova Atlas', 'Glass Echo', 'Solar Drift', 'Prism Guild', 'Neon Hollow']
const creators = ['Nyra', 'Vega', 'Luca', 'Sora', 'Talon']

const artworks = [
  { file: 'Capacete cósmico de vidro.png', title: 'Cosmic Glass Helmet', category: 'Helmet' },
  { file: 'Portal rosa cromado sobre o oceano.png', title: 'Chrome Ocean Portal', category: 'Landscape' },
  { file: 'Busto prateado, faixa cromada e luz laranja.png', title: 'Silver Solar Bust', category: 'Portrait' },
  { file: 'Bonsai de cobre com folhas âmbar-9.png', title: 'Amber Copper Bonsai', category: 'Abstract' },
  { file: 'Borboleta de opala em vitral luminoso-8.png', title: 'Opal Glasswing', category: 'Abstract' },
  { file: 'Carpa dourada em fitas de safira-2.png', title: 'Sapphire Ribbon Koi', category: 'Abstract' },
  { file: 'Dragão esmeralda sobre ilha basáltica-1.png', title: 'Emerald Island Dragon', category: 'Portrait' },
  { file: 'Esfera espelhada sobre escadarias cobalto-6.png', title: 'Cobalt Mirror Sphere', category: 'Architecture' },
  { file: 'Jardim japonês flutuante em cubo de vidro-3.png', title: 'Floating Glass Garden', category: 'Landscape' },
  { file: 'Medusa cósmica de tentáculos iridescentes-4.png', title: 'Iridescent Cosmic Medusa', category: 'Abstract' },
  { file: 'Pantera de obsidiana com veios dourados-5.png', title: 'Obsidian Gold Panther', category: 'Portrait' },
  { file: 'Robô retrô de cerâmica e vidro laranja-7.png', title: 'Retro Ceramic Robot', category: 'Abstract' },
  { file: 'Tênis futurista de prata líquida-10.png', title: 'Liquid Silver Sneaker', category: 'Abstract' },
]

export const nftCatalog: Nft[] = artworks.map((artwork, index) => {
  const collection = collections[index % collections.length]
  const creator = creators[index % creators.length]
  const price = (0.12 + (index * 0.08) % 3.2).toFixed(2)
  const image = new URL(`../assets/${artwork.file}`, import.meta.url).href

  return {
    id: `nft-${index + 1}`,
    title: artwork.title,
    collection,
    creator,
    priceEth: price,
    image,
    imageAlt: `${artwork.title} artwork`,
    category: artwork.category,
    stock: 1 + ((index * 3) % 7),
    version: `v${1 + (index % 4)}`,
    description: `Limited edition release from the ${collection} series by ${creator}.`,
    tags: [collection, artwork.category, 'rare', 'curated'],
    isFeatured: index % 5 === 0,
  }
})

export const demoUsers: User[] = [
  {
    id: 'user-1',
    name: 'Ari Nova',
    email: 'ari@jungle.market',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    primaryWallet: '0x1f0f...b93a',
    wallets: ['0x1f0f...b93a', '0x4e2a...9132'],
    favorites: ['nft-3', 'nft-7'],
  },
  {
    id: 'user-2',
    name: 'Mina Sol',
    email: 'mina@jungle.market',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    primaryWallet: '0x7b27...f510',
    wallets: ['0x7b27...f510'],
    favorites: ['nft-1', 'nft-9'],
  },
]

export const defaultWallets = ['0x1f0f...b93a', '0x4e2a...9132', '0x7b27...f510']
