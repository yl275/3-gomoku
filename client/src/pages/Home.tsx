import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SERVER_URL = 'http://localhost:4000';

interface GameSettings {
  playerCount: 2 | 3;
  winCondition: 5 | 6;
  boardSize: 15 | 19;
}

const Home: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    playerCount: 2,
    winCondition: 5,
    boardSize: 15
  });
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setIsLoading(true);
    setError('');
    
    try {
      // 直接导航到房间，后端会自动创建房间如果不存在
      navigate(`/room/${roomCode.trim()}`);
    } catch (err) {
      setError('Failed to join room. Please try again.');
      console.error('Error joining room:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewRoom = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${SERVER_URL}/api/create-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameSettings)
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      setError('Failed to create room. Please try again.');
      console.error('Error creating room:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClick = () => {
    setShowCreateForm(true);
  };

  const handleBackToHome = () => {
    setShowCreateForm(false);
    setError('');
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center p-2 overflow-hidden">
      <h1 className="text-2xl font-bold mb-1">Welcome to Gomoku</h1>
      <p className="text-gray-500 mb-2 text-xs">Start a new game or join an existing room.</p>
      
      {error && (
        <div className="w-full max-w-sm mb-2 p-2 bg-red-100 border border-red-300 text-red-700 text-xs rounded">
          {error}
        </div>
      )}
      
      {!showCreateForm ? (
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="mb-2">
            <div className="mb-2">
              <label htmlFor="roomCode" className="block text-xs font-medium text-gray-500 mb-1">
                Room Code:
              </label>
              <input
                type="text"
                id="roomCode"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter room code"
                disabled={isLoading}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!roomCode.trim() || isLoading}
              className="w-full bg-blue-600 text-white py-1 px-3 text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </button>
          </form>
          
          <div className="text-center mb-2">
            <span className="text-gray-500 text-xs">or</span>
          </div>
          
          <button
            onClick={handleCreateClick}
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-1 px-3 text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create New Room
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-800">Game Settings</h2>
            
            {/* Player Count */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Number of Players:
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setGameSettings(prev => ({ ...prev, playerCount: 2 }))}
                  className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                    gameSettings.playerCount === 2 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  2 Players
                </button>
                <button
                  type="button"
                  onClick={() => setGameSettings(prev => ({ ...prev, playerCount: 3 }))}
                  className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                    gameSettings.playerCount === 3 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  3 Players
                </button>
              </div>
            </div>

            {/* Win Condition */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Win Condition:
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setGameSettings(prev => ({ ...prev, winCondition: 5 }))}
                  className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                    gameSettings.winCondition === 5 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  5 in a row
                </button>
                <button
                  type="button"
                  onClick={() => setGameSettings(prev => ({ ...prev, winCondition: 6 }))}
                  className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                    gameSettings.winCondition === 6 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  6 in a row
                </button>
              </div>
            </div>

            {/* Board Size */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Board Size:
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setGameSettings(prev => ({ ...prev, boardSize: 15 }))}
                  className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                    gameSettings.boardSize === 15 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  15×15
                </button>
                <button
                  type="button"
                  onClick={() => setGameSettings(prev => ({ ...prev, boardSize: 19 }))}
                  className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                    gameSettings.boardSize === 19 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  19×19
                </button>
              </div>
            </div>

            {/* Game Summary */}
            <div className="bg-gray-50 rounded p-2 mb-4">
              <p className="text-xs text-gray-600">
                <strong>Game Summary:</strong><br/>
                • {gameSettings.playerCount} players<br/>
                • {gameSettings.winCondition} in a row to win<br/>
                • {gameSettings.boardSize}×{gameSettings.boardSize} board
              </p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleBackToHome}
              disabled={isLoading}
              className="flex-1 bg-gray-500 text-white py-1 px-3 text-sm rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={createNewRoom}
              disabled={isLoading}
              className="flex-1 bg-green-600 text-white py-1 px-3 text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
