import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import type { TriviaCard, CardPack } from '../store';

const TriviaCards: React.FC = () => {
  const {
    userCards,
    userCurrency,
    cardCollection,
    cardMarket,
    setGameState,
    setUserCards,
    setUserCurrency,
    setCardCollection,
    setCardMarket
  } = useGameStore();

  const [currentView, setCurrentView] = useState<'collection' | 'packs' | 'market'>('collection');
  const [selectedPack, setSelectedPack] = useState<CardPack | null>(null);
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [newCards, setNewCards] = useState<TriviaCard[]>([]);

  // Initialize card collection and market if empty
  useEffect(() => {
    if (cardCollection.length === 0) {
      initializeCardData();
    }
  }, [cardCollection.length]);

  const initializeCardData = () => {
    // Sample K-pop idol cards
    const sampleCards: TriviaCard[] = [
      {
        id: 'rumi-001',
        name: 'Rumi',
        group: 'HUNTR/X',
        imageUrl: '/5of5.jpg',
        rarity: 'legendary',
        facts: ['Leader of HUNTR/X', 'Amazing vocalist', 'Half-demon heritage'],
        value: 500,
        owned: false
      },
      {
        id: 'mira-002',
        name: 'Mira',
        group: 'HUNTR/X',
        imageUrl: '/1to4.jpg',
        rarity: 'epic',
        facts: ['Main dancer', 'Wealthy background', 'Polearm expert'],
        value: 300,
        owned: false
      },
      {
        id: 'zoey-003',
        name: 'Zoey',
        group: 'HUNTR/X',
        imageUrl: '/allwrong.webp',
        rarity: 'rare',
        facts: ['Maknae', 'Knife specialist', 'Korean-American'],
        value: 150,
        owned: false
      },
      {
        id: 'celine-004',
        name: 'Celine',
        group: 'HUNTR/X',
        imageUrl: '/vite.svg',
        rarity: 'epic',
        facts: ['Former hunter', 'Rumi\'s guardian', 'Experienced fighter'],
        value: 250,
        owned: false
      }
    ];

    const samplePacks: CardPack[] = [
      {
        id: 'starter-pack',
        name: 'Starter Pack',
        description: 'Begin your collection with common and rare cards',
        cost: 50,
        cards: ['zoey-003', 'celine-004'],
        imageUrl: '/vite.svg'
      },
      {
        id: 'premium-pack',
        name: 'Premium Pack',
        description: 'Higher chance for epic and legendary cards',
        cost: 150,
        cards: ['rumi-001', 'mira-002', 'zoey-003'],
        imageUrl: '/vite.svg'
      }
    ];

    setCardCollection(sampleCards);
    setCardMarket(samplePacks);
  };

  const openPack = (pack: CardPack) => {
    if (userCurrency < pack.cost) {
      alert('Not enough currency!');
      return;
    }

    setSelectedPack(pack);
    setIsOpeningPack(true);
    setUserCurrency(userCurrency - pack.cost);

    // Simulate pack opening animation
    setTimeout(() => {
      const wonCards = pack.cards.map(cardId => {
        const card = cardCollection.find(c => c.id === cardId);
        return card ? { ...card, owned: true } : null;
      }).filter(Boolean) as TriviaCard[];

      setNewCards(wonCards);

      // Add cards to user's collection
      const updatedUserCards = [...userCards];
      wonCards.forEach(card => {
        if (!updatedUserCards.find(uc => uc.id === card.id)) {
          updatedUserCards.push(card);
        }
      });
      setUserCards(updatedUserCards);

      setTimeout(() => {
        setIsOpeningPack(false);
        setSelectedPack(null);
        setNewCards([]);
      }, 3000);
    }, 2000);
  };

  const sellCard = (card: TriviaCard) => {
    const updatedUserCards = userCards.filter(uc => uc.id !== card.id);
    setUserCards(updatedUserCards);
    setUserCurrency(userCurrency + Math.floor(card.value * 0.7)); // 70% of value when selling
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-400';
      case 'rare': return 'bg-blue-400';
      case 'epic': return 'bg-purple-400';
      case 'legendary': return 'bg-yellow-400';
      default: return 'bg-gray-400';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'shadow-yellow-400 shadow-lg';
      case 'epic': return 'shadow-purple-400 shadow-md';
      case 'rare': return 'shadow-blue-400 shadow-sm';
      default: return '';
    }
  };

  if (isOpeningPack && selectedPack) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center min-h-screen px-4 bg-kid-pattern"
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-8xl mb-8"
          >
            🎴
          </motion.div>
          <h2 className="text-3xl font-bold text-purple-600 mb-4">Opening Pack...</h2>
          <p className="text-lg text-gray-600">Get ready for your new cards!</p>
        </div>

        <AnimatePresence>
          {newCards.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {newCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.2 }}
                  className={`p-4 rounded-2xl ${getRarityColor(card.rarity)} ${getRarityGlow(card.rarity)} text-white`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-2">👤</div>
                    <h3 className="text-xl font-bold">{card.name}</h3>
                    <p className="text-sm opacity-90">{card.group}</p>
                    <div className="mt-2 px-2 py-1 bg-white bg-opacity-20 rounded-full text-xs font-bold">
                      {card.rarity.toUpperCase()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 bg-kid-pattern"
    >
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <motion.h1
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-4xl md:text-6xl font-fredoka font-bold text-purple-600 text-kid-glow"
          >
            🎴 Trivia Cards
          </motion.h1>
          <div className="text-2xl font-bold text-yellow-600 bg-yellow-100 px-4 py-2 rounded-full">
            💰 {userCurrency}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-full p-1 shadow-lg">
            {(['collection', 'packs', 'market'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`px-6 py-3 rounded-full font-bold transition-all ${
                  currentView === view
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Collection View */}
        {currentView === 'collection' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {userCards.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">🎴</div>
                <h3 className="text-2xl font-bold text-gray-600 mb-2">No Cards Yet!</h3>
                <p className="text-gray-500 mb-4">Open some packs to start your collection</p>
                <button
                  onClick={() => setCurrentView('packs')}
                  className="btn-kid"
                >
                  Open Your First Pack
                </button>
              </div>
            ) : (
              userCards.map((card) => (
                <motion.div
                  key={card.id}
                  whileHover={{ scale: 1.05 }}
                  className={`p-6 rounded-3xl ${getRarityColor(card.rarity)} ${getRarityGlow(card.rarity)} text-white shadow-lg`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">👤</div>
                    <h3 className="text-xl font-bold mb-1">{card.name}</h3>
                    <p className="text-sm opacity-90 mb-3">{card.group}</p>

                    <div className="mb-4">
                      <div className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-xs font-bold mb-2">
                        {card.rarity.toUpperCase()}
                      </div>
                      <div className="text-sm font-bold">Value: 💰{card.value}</div>
                    </div>

                    <div className="space-y-1 mb-4">
                      {card.facts.slice(0, 2).map((fact, index) => (
                        <div key={index} className="text-xs bg-white bg-opacity-10 rounded-lg p-2">
                          {fact}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => sellCard(card)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition-colors"
                    >
                      Sell (💰{Math.floor(card.value * 0.7)})
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Packs View */}
        {currentView === 'packs' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {cardMarket.map((pack) => (
              <motion.div
                key={pack.id}
                whileHover={{ scale: 1.05 }}
                className="bg-white p-6 rounded-3xl shadow-lg border-2 border-purple-200"
              >
                <div className="text-center">
                  <div className="text-6xl mb-4">📦</div>
                  <h3 className="text-2xl font-bold text-purple-600 mb-2">{pack.name}</h3>
                  <p className="text-gray-600 mb-4">{pack.description}</p>
                  <div className="text-3xl font-bold text-yellow-600 mb-4">💰{pack.cost}</div>

                  <button
                    onClick={() => openPack(pack)}
                    disabled={userCurrency < pack.cost}
                    className={`w-full font-bold py-3 px-6 rounded-full transition-all ${
                      userCurrency >= pack.cost
                        ? 'btn-kid'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {userCurrency >= pack.cost ? 'Open Pack' : 'Not Enough Currency'}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Market View */}
        {currentView === 'market' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2">Trading Market</h3>
            <p className="text-gray-500">Coming soon! Trade cards with other players.</p>
          </motion.div>
        )}

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <button
            onClick={() => setGameState('game_mode')}
            className="btn-kid-secondary"
          >
            ← Back to Game Selection
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TriviaCards;
