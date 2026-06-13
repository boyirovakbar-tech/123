export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  speed: number;    // Paddle movement multiplier
  power: number;    // Speed boost on ball hit
  curve: number;    // Spin / angle deflection index
  soundFX: string;  // Character vocal hit accentuation style
  color: string;
  underwearStyle: string;
}

export interface GameState {
  playerScore: number;
  opponentScore: number;
  gameState: 'MENU' | 'CHARACTER_SELECT' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';
  selectedPlayer: Character | null;
  selectedOpponent: Character | null;
  ballX: number;
  ballY: number;
  ballSpeedX: number;
  ballSpeedY: number;
  ballSpeedMultiplier: number;
  playerPaddleY: number;
  opponentPaddleY: number;
  serveTurn: 'PLAYER' | 'OPPONENT';
  rallyCount: number;
  winnerId: string | null;
  matchDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
}
