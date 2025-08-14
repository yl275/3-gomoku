import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:4000';

interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O' | 'T';
  isCurrentTurn: boolean;
}

interface GameState {
  board: (string | null)[][];
  currentPlayer: 'X' | 'O' | 'T';
  winner: string | null;
  gameOver: boolean;
  isDraw: boolean;
  settings: {
    playerCount: 2 | 3;
    winCondition: 5 | 6;
    boardSize: 15 | 19;
  };
}

const Room: React.FC = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    board: Array(15).fill(null).map(() => Array(15).fill(null)),
    currentPlayer: 'X',
    winner: null,
    gameOver: false,
    isDraw: false,
    settings: {
      playerCount: 2,
      winCondition: 5,
      boardSize: 15
    }
  });
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Player 1', symbol: 'X', isCurrentTurn: true },
    { id: '2', name: 'Player 2', symbol: 'O', isCurrentTurn: false }
  ]);
  const [mySide, setMySide] = useState<'black' | 'white' | 'green' | 'spectator' | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [allPlayersConnected, setAllPlayersConnected] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    console.log('Connecting to server:', SERVER_URL);
    console.log('Room ID:', roomId);

    // 连接到WebSocket服务器
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    setSocket(newSocket);

    // 加入房间
    newSocket.emit('join_room', { roomId });

    // 监听连接状态
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server, socket ID:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Disconnected from server, reason:', reason);
    });

    // 监听加入房间结果
    newSocket.on('joined', (data: any) => {
      console.log('Joined room:', data);
      setMySide(data.side);
      
      // 转换服务器数据格式到前端格式
      const board = data.board.map((row: number[]) => 
        row.map((cell: number) => {
          if (cell === 0) return null;
          if (cell === 1) return 'X'; // 黑棋
          if (cell === 2) return 'O'; // 白棋
          if (cell === 3) return 'T'; // 第三玩家
          return null;
        })
      );
      
      setGameState(prev => ({
        ...prev,
        board,
        currentPlayer: data.turn === 1 ? 'X' : data.turn === 2 ? 'O' : 'T',
        settings: data.settings || prev.settings
      }));

      // 设置初始回合状态
      setIsMyTurn(
        (data.side === 'black' && data.turn === 1) || 
        (data.side === 'white' && data.turn === 2) ||
        (data.side === 'third' && data.turn === 3)
      );
    });

    // 监听房间状态更新
    newSocket.on('room_state', (data: any) => {
      console.log('Room state:', data);
      console.log('Current mySide:', mySide);
      
      // 检查是否所有玩家都已连接
      const allConnected = data.players.black && data.players.white && 
        (data.settings?.playerCount === 2 || data.players.third);
      setAllPlayersConnected(allConnected);
      console.log('All players connected:', allConnected);
      
      // 根据当前玩家的身份设置正确的玩家信息
      const blackPlayer: Player = {
        id: '1', 
        name: mySide === 'black' ? 'You (Black)' : 'Black Player', 
        symbol: 'X' as const, 
        isCurrentTurn: data.turn === 1
      };
      
      const whitePlayer: Player = {
        id: '2', 
        name: mySide === 'white' ? 'You (White)' : 'White Player', 
        symbol: 'O' as const, 
        isCurrentTurn: data.turn === 2
      };

      const playersList = [blackPlayer, whitePlayer];

      // 如果是三人游戏，添加第三玩家
      if (data.settings?.playerCount === 3) {
        const thirdPlayer: Player = {
          id: '3',
          name: mySide === 'green' ? 'You (Green)' : 'Green Player',
          symbol: 'T' as const,
          isCurrentTurn: data.turn === 3
        };
        playersList.push(thirdPlayer);
      }
      
      setPlayers(playersList);
      
      // 更新游戏状态中的当前玩家
      setGameState(prev => ({
        ...prev,
        currentPlayer: data.turn === 1 ? 'X' : data.turn === 2 ? 'O' : 'T',
        settings: data.settings || prev.settings
      }));
      
      console.log('Room state updated - turn:', data.turn, 'allConnected:', allConnected);
    });

    // 监听棋子放置
    newSocket.on('piece_placed', (data: any) => {
      console.log('Piece placed:', data);
      const { x, y, player } = data;
      const symbol = player === 'black' ? 'X' : player === 'white' ? 'O' : 'T';
      
      setGameState(prev => {
        const newBoard = prev.board.map(row => [...row]);
        newBoard[y][x] = symbol;
        return {
          ...prev,
          board: newBoard
        };
      });
    });

    // 监听回合变化
    newSocket.on('turn_changed', (data: any) => {
      console.log('Turn changed:', data);
      console.log('Current mySide:', mySide);
      console.log('All players connected:', allPlayersConnected);
      
      const currentPlayer = data.turn === 'black' ? 'X' : data.turn === 'white' ? 'O' : 'T';
      setGameState(prev => ({
        ...prev,
        currentPlayer
      }));
      
      // 更新玩家状态
      setPlayers(prev => prev.map(player => ({
        ...player,
        isCurrentTurn: (player.symbol === 'X' && data.turn === 'black') || 
                      (player.symbol === 'O' && data.turn === 'white') ||
                      (player.symbol === 'T' && data.turn === 'green')
      })));
      
      console.log('Turn changed to:', data.turn, 'currentPlayer:', currentPlayer);
    });

    // 监听游戏结束
    newSocket.on('game_over', (data: any) => {
      console.log('Game over:', data);
      setGameState(prev => ({
        ...prev,
        winner: data.draw ? null : (data.winner === 'black' ? 'X' : data.winner === 'white' ? 'O' : 'T'),
        gameOver: true,
        isDraw: data.draw || false
      }));
    });

    // 监听游戏重置
    newSocket.on('reset_done', (data: any) => {
      console.log('Game reset:', data);
      const board = data.board.map((row: number[]) => 
        row.map((cell: number) => {
          if (cell === 0) return null;
          if (cell === 1) return 'X';
          if (cell === 2) return 'O';
          return null;
        })
      );
      
      setGameState({
        board,
        currentPlayer: 'X',
        winner: null,
        gameOver: false,
        isDraw: false,
        settings: gameState.settings
      });
      
      // 重置后黑棋先手
      if (mySide) {
        setIsMyTurn(mySide === 'black');
        console.log('Game reset, mySide:', mySide, 'isMyTurn:', mySide === 'black');
      }
    });

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.disconnect();
    };
  }, [roomId]);

  // 当mySide改变时，重新计算回合状态
  useEffect(() => {
    if (mySide && socket) {
      // 重新获取房间状态来确保回合状态正确
      socket.emit('get_room_state', { roomId });
    }
  }, [mySide, socket, roomId]);

  // 同步回合状态
  useEffect(() => {
    if (mySide && gameState.currentPlayer && allPlayersConnected) {
      const isMyTurn = (mySide === 'black' && gameState.currentPlayer === 'X') || 
                      (mySide === 'white' && gameState.currentPlayer === 'O') ||
                      (mySide === 'green' && gameState.currentPlayer === 'T');
      setIsMyTurn(isMyTurn);
      console.log('Turn state synced - mySide:', mySide, 'currentPlayer:', gameState.currentPlayer, 'bothConnected:', allPlayersConnected, 'isMyTurn:', isMyTurn);
    } else {
      setIsMyTurn(false);
      console.log('Turn state blocked - mySide:', mySide, 'currentPlayer:', gameState.currentPlayer, 'bothConnected:', allPlayersConnected);
    }
  }, [mySide, gameState.currentPlayer, allPlayersConnected]);

  const handleCellClick = (row: number, col: number) => {
    console.log('=== Cell Click Debug ===');
    console.log('Cell clicked:', row, col);
    console.log('Socket connected:', !!socket);
    console.log('Is my turn:', isMyTurn);
    console.log('Both players connected:', allPlayersConnected);
    console.log('Game over:', gameState.gameOver);
    console.log('Cell is empty:', gameState.board[row][col] === null);
    console.log('My side:', mySide);
    console.log('Current player:', gameState.currentPlayer);
    console.log('=======================');
    
    if (!socket) {
      console.log('Click blocked: No socket connection');
      return;
    }
    
    if (!allPlayersConnected) {
      console.log('Click blocked: Both players not connected');
      return;
    }
    
    if (!isMyTurn) {
      console.log('Click blocked: Not my turn');
      return;
    }
    
    if (gameState.gameOver) {
      console.log('Click blocked: Game is over');
      return;
    }
    
    if (gameState.board[row][col] !== null) {
      console.log('Click blocked: Cell is not empty');
      return;
    }

    console.log('Sending place_piece event');
    // 发送下棋请求到服务器
    socket.emit('place_piece', { roomId, x: col, y: row });
  };

  const resetGame = () => {
    if (!socket) return;
    socket.emit('reset_game', { roomId });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId || '');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-amber-100">
      {/* Header */}
      <div className="bg-amber-200 shadow-sm border-b border-amber-300 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-amber-800 hover:text-amber-900 transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold text-amber-900">Room: {roomId}</h1>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          <button
            onClick={copyRoomCode}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Copy Room Code
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Game Board */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-amber-200 rounded-lg shadow-lg p-6 border-2 border-amber-300">
            {/* Traditional Gomoku Board with Lines */}
            <div className="relative bg-amber-100 p-4 rounded border border-amber-500 gomoku-board">
              {/* Grid Lines */}
              <div 
                className="relative"
                style={{
                  width: `${gameState.settings.boardSize * 32}px`,
                  height: `${gameState.settings.boardSize * 32}px`
                }}
              >
                {/* Horizontal Lines */}
                {Array.from({ length: gameState.settings.boardSize }, (_, i) => (
                  <div
                    key={`h-${i}`}
                    className="absolute w-full h-px board-line"
                    style={{ top: `${i * 32}px` }}
                  />
                ))}
                
                {/* Vertical Lines */}
                {Array.from({ length: gameState.settings.boardSize }, (_, i) => (
                  <div
                    key={`v-${i}`}
                    className="absolute h-full w-px board-line"
                    style={{ left: `${i * 32}px` }}
                  />
                ))}
                
                {/* Intersection Points for Pieces */}
                {gameState.board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      disabled={!isMyTurn || !allPlayersConnected || gameState.gameOver || cell !== null}
                      className={`
                        absolute w-6 h-6 rounded-full flex items-center justify-center
                        transform -translate-x-1/2 -translate-y-1/2
                        ${cell === 'X' ? 'piece-black' : ''}
                        ${cell === 'O' ? 'piece-white' : ''}
                        ${cell === 'T' ? 'piece-third' : ''}
                        ${cell === null ? 'intersection-point' : ''}
                        ${!isMyTurn || !allPlayersConnected || gameState.gameOver || cell !== null ? 'cursor-not-allowed' : 'cursor-pointer'}
                        transition-all duration-200
                      `}
                      style={{
                        left: `${colIndex * 32}px`,
                        top: `${rowIndex * 32}px`
                      }}
                      title={`${rowIndex},${colIndex} - My turn: ${isMyTurn}, All connected: ${allPlayersConnected}, Game over: ${gameState.gameOver}, Empty: ${cell === null}`}
                    >
                      {/* No inner div needed - the button itself is the piece */}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-amber-200 border-l border-amber-300 p-4 space-y-4">
          {/* Connection Status */}
          <div className="bg-amber-100 rounded-lg p-4 border border-amber-300">
            <h3 className="font-semibold mb-3 text-amber-900">Connection</h3>
            <div className="space-y-2 text-sm">
              <p className="text-amber-700">Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
              <p className="text-amber-700">Your Side: {mySide || 'Unknown'}</p>
              <p className="text-amber-700">Can Move: {isMyTurn ? 'Yes' : 'No'}</p>
              <p className="text-amber-700">Both Players: {allPlayersConnected ? 'Connected' : 'Waiting...'}</p>
            </div>
          </div>

          {/* Game Status */}
          <div className="bg-amber-100 rounded-lg p-4 border border-amber-300">
            <h3 className="font-semibold mb-3 text-amber-900">Game Status</h3>
            {!allPlayersConnected ? (
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600 mb-2">
                  Waiting for opponent...
                </p>
                <p className="text-sm text-amber-500">
                  {mySide === 'black' ? 'You are Black' : 
                   mySide === 'white' ? 'You are White' : 
                   mySide === 'green' ? 'You are Green' : 
                   'You are Spectator'}
                </p>
                <div className="mt-2 flex justify-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${mySide === 'black' ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
                  <span className="text-xs text-amber-600">Black</span>
                  <div className={`w-3 h-3 rounded-full ${mySide === 'white' ? 'bg-white border border-gray-300' : 'bg-gray-300'}`}></div>
                  <span className="text-xs text-amber-600">White</span>
                  {gameState.settings.playerCount === 3 && (
                    <>
                      <div className={`w-3 h-3 rounded-full ${mySide === 'green' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className="text-xs text-amber-600">Green</span>
                    </>
                  )}
                </div>
              </div>
            ) : gameState.winner ? (
              <div className="text-center">
                <p className="text-lg font-bold text-black mb-2">
                  {gameState.winner === 'X' ? 'Black' : gameState.winner === 'O' ? 'White' : 'Green'} Wins!
                </p>
                <button
                  onClick={resetGame}
                  className="px-4 py-2 bg-black text-black rounded-md hover:bg-gray-800 transition-colors"
                >
                  New Game
                </button>
              </div>
            ) : gameState.isDraw ? (
              <div className="text-center">
                <p className="text-lg font-bold text-gray-600 mb-2">It's a Draw!</p>
                <button
                  onClick={resetGame}
                  className="px-4 py-2 bg-black text-black rounded-md hover:bg-gray-800 transition-colors"
                >
                  New Game
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-amber-700 mb-2">Current Turn:</p>
                <p className={`text-lg font-bold ${
                  gameState.currentPlayer === 'X' ? 'text-gray-800' : 
                  gameState.currentPlayer === 'O' ? 'text-gray-600' : 
                  'text-green-600'
                }`}>
                  {gameState.currentPlayer === 'X' ? 'Black' : gameState.currentPlayer === 'O' ? 'White' : 'Green'}
                </p>
                {!isMyTurn && <p className="text-sm text-amber-600 mt-1">Waiting for opponent...</p>}
              </div>
            )}
          </div>

          {/* Players */}
          <div className="bg-amber-100 rounded-lg p-4 border border-amber-300">
            <h3 className="font-semibold mb-3 text-amber-900">Players</h3>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2 rounded ${
                    player.isCurrentTurn && !gameState.gameOver ? 'bg-blue-100 border border-blue-200' : 'bg-amber-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      player.symbol === 'X' ? 'bg-gray-800' : 
                      player.symbol === 'O' ? 'bg-white border border-gray-300' : 
                      'bg-green-500'
                    }`}></div>
                    <span className="text-sm font-medium text-amber-900">{player.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    player.symbol === 'X' ? 'text-gray-800' : 
                    player.symbol === 'O' ? 'text-gray-600' : 
                    'text-green-600'
                  }`}>
                    {player.symbol}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Game Info */}
          <div className="bg-amber-100 rounded-lg p-4 border border-amber-300">
            <h3 className="font-semibold mb-3 text-amber-900">Game Info</h3>
            <div className="space-y-2 text-sm text-amber-700">
              <p>Board Size: {gameState.settings.boardSize}×{gameState.settings.boardSize}</p>
              <p>Win Condition: {gameState.settings.winCondition} in a row</p>
              <p>Room Code: {roomId}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
