import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

// Define shop items
const SHOP_ITEMS = [
  { id: 'rare_star', name: 'Rare Star Sticker', price: 10, emoji: '🌟', type: 'sticker' },
  { id: 'golden_heart', name: 'Golden Heart Sticker', price: 15, emoji: '💛', type: 'sticker' },
  { id: 'unicorn_magic', name: 'Unicorn Magic Sticker', price: 25, emoji: '🦄', type: 'sticker' },
  { id: 'dark_theme', name: 'Dark Mode Theme', price: 50, emoji: '🌚', type: 'theme' },
  { id: 'neon_party', name: 'Neon Party Music Pack', price: 30, emoji: '🎉', type: 'music' }
];

const Shop: React.FC = () => {
  const { userCurrency, setUserCurrency, setGameState, addToInventory, inventory } = useGameStore();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleBuy = (item: typeof SHOP_ITEMS[0]) => {
    if (inventory.includes(item.id)) {
        return; // Already owned
    }
    if (userCurrency >= item.price) {
      setUserCurrency(userCurrency - item.price);
      addToInventory(item.id);
      setSuccessMessage(`Purchased ${item.name}! 🎉`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      alert('Not enough treasure points! Earn more by playing! 💰');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-blue-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-fredoka font-bold text-yellow-400 mb-4">💎 TREASURE SHOP</h1>
          <p className="text-xl text-gray-300">Spend your coins on awesome upgrades!</p>
          <p className="text-2xl text-cyan-400 font-bold mt-4">Your Coins: 💰 {userCurrency}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {SHOP_ITEMS.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-gray-800 p-6 rounded-3xl shadow-xl border-4 border-purple-500"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-6xl">{item.emoji}</span>
                <span className="text-3xl font-bold text-yellow-400">💰 {item.price}</span>
              </div>
              <h3 className="text-xl font-fredoka font-bold mb-4">{item.name}</h3>
              <button
                onClick={() => handleBuy(item)}
                disabled={userCurrency < item.price || inventory.includes(item.id)}
                className={`w-full py-3 rounded-xl font-fredoka font-bold text-lg ${
                  inventory.includes(item.id)
                    ? 'bg-gray-500 cursor-default'
                    : userCurrency >= item.price
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:scale-105 transition-transform shadow-lg'
                    : 'bg-gray-600 cursor-not-allowed opacity-50'
                }`}
              >
                {inventory.includes(item.id) 
                    ? '✅ Owned' 
                    : userCurrency >= item.price 
                        ? 'Buy Now!' 
                        : 'Need More Coins'}
              </button>
            </motion.div>
          ))}
        </div>

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-600 text-white p-4 rounded-3xl text-center font-bold text-xl mb-4"
          >
            {successMessage}
          </motion.div>
        )}

        <motion.button
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setGameState('agent_hq')}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-3xl font-bold font-fredoka text-lg hover:scale-105 transition-transform shadow-xl"
        >
          ◀ Back to HQ
        </motion.button>
      </div>
    </div>
  );
};

export default Shop;
