// ============================================================
// NEON CHESS - Complete Chess Implementation
// ============================================================

const PIECES = {
    KING: 'K', QUEEN: 'Q', ROOK: 'R', BISHOP: 'B', KNIGHT: 'N', PAWN: 'P'
};

const COLORS = { WHITE: 'w', BLACK: 'b' };

// Unicode chess pieces
const SYMBOLS = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};

class ChessGame {
    constructor() {
        this.board = [];
        this.turn = COLORS.WHITE;
        this.moveHistory = [];
        this.capturedPieces = { w: [], b: [] };
        this.gameOver = false;
        this.selectedSquare = null;
        this.validMoves = [];
        this.lastMove = null;
        this.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
        this.enPassantTarget = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        
        this.initBoard();
    }
    
    initBoard() {
        // Initialize empty 8x8 board
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Set up pieces
        const backRow = [PIECES.ROOK, PIECES.KNIGHT, PIECES.BISHOP, PIECES.QUEEN, PIECES.KING, PIECES.BISHOP, PIECES.KNIGHT, PIECES.ROOK];
        
        // White pieces (rank 0 and 1)
        for (let i = 0; i < 8; i++) {
            this.board[0][i] = { type: backRow[i], color: COLORS.WHITE };
            this.board[1][i] = { type: PIECES.PAWN, color: COLORS.WHITE };
        }
        
        // Black pieces (rank 6 and 7)
        for (let i = 0; i < 8; i++) {
            this.board[6][i] = { type: PIECES.PAWN, color: COLORS.BLACK };
            this.board[7][i] = { type: backRow[i], color: COLORS.BLACK };
        }
    }
    
    // Get piece at position
    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return undefined;
        return this.board[row][col];
    }
    
    // Check if square is attacked by a color
    isAttacked(row, col, byColor) {
        // Pawn attacks
        const pawnDir = byColor === COLORS.WHITE ? 1 : -1;
        for (const dc of [-1, 1]) {
            const pr = row + pawnDir;
            const pc = col + dc;
            const piece = this.getPiece(pr, pc);
            if (piece && piece.type === PIECES.PAWN && piece.color === byColor) return true;
        }
        
        // Knight attacks
        const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of knightMoves) {
            const piece = this.getPiece(row + dr, col + dc);
            if (piece && piece.type === PIECES.KNIGHT && piece.color === byColor) return true;
        }
        
        // King attacks
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const piece = this.getPiece(row + dr, col + dc);
                if (piece && piece.type === PIECES.KING && piece.color === byColor) return true;
            }
        }
        
        // Sliding pieces (Rook, Bishop, Queen)
        const directions = [
            [0,1],[0,-1],[1,0],[-1,0], // Rook
            [1,1],[1,-1],[-1,1],[-1,-1] // Bishop
        ];
        
        for (let i = 0; i < directions.length; i++) {
            const [dr, dc] = directions[i];
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = this.board[r][c];
                if (piece) {
                    if (piece.color === byColor) {
                        const isRook = i < 4;
                        const isBishop = i >= 4;
                        if (piece.type === PIECES.QUEEN || 
                            (isRook && piece.type === PIECES.ROOK) || 
                            (isBishop && piece.type === PIECES.BISHOP)) {
                            return true;
                        }
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }
        
        return false;
    }
    
    // Find king position
    findKing(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.type === PIECES.KING && piece.color === color) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }
    
    // Check if king is in check
    isInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
        return this.isAttacked(kingPos.row, kingPos.col, enemyColor);
    }
    
    // Generate pseudo-legal moves for a piece
    generateMoves(row, col, checkLegal = true) {
        const piece = this.board[row][col];
        if (!piece) return [];
        
        const moves = [];
        const color = piece.color;
        const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
        
        const addMove = (toRow, toCol, special = null) => {
            if (checkLegal) {
                // Simulate move
                const captured = this.board[toRow][toCol];
                this.board[toRow][toCol] = piece;
                this.board[row][col] = null;
                
                // Handle en passant capture
                let epCaptured = null;
                if (special === 'ep') {
                    epCaptured = this.board[row][toCol];
                    this.board[row][toCol] = null;
                }
                
                if (!this.isInCheck(color)) {
                    moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, captured, special });
                }
                
                // Undo simulation
                this.board[row][col] = piece;
                this.board[toRow][toCol] = captured;
                if (special === 'ep') {
                    this.board[row][toCol] = epCaptured;
                }
            } else {
                moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, captured: this.board[toRow][toCol], special });
            }
        };
        
        switch (piece.type) {
            case PIECES.PAWN: {
                const dir = color === COLORS.WHITE ? 1 : -1;
                const startRank = color === COLORS.WHITE ? 1 : 6;
                const promoRank = color === COLORS.WHITE ? 7 : 0;
                
                // Forward
                if (!this.getPiece(row + dir, col)) {
                    if (row + dir === promoRank) {
                        [PIECES.QUEEN, PIECES.ROOK, PIECES.BISHOP, PIECES.KNIGHT].forEach(p => {
                            addMove(row + dir, col, 'promotion');
                        });
                    } else {
                        addMove(row + dir, col);
                    }
                    
                    // Double forward
                    if (row === startRank && !this.getPiece(row + 2 * dir, col)) {
                        addMove(row + 2 * dir, col, 'double');
                    }
                }
                
                // Captures
                for (const dc of [-1, 1]) {
                    const nc = col + dc;
                    if (nc >= 0 && nc < 8) {
                        const target = this.getPiece(row + dir, nc);
                        if (target && target.color === enemyColor) {
                            if (row + dir === promoRank) {
                                addMove(row + dir, nc, 'promotion');
                            } else {
                                addMove(row + dir, nc);
                            }
                        }
                        
                        // En passant
                        if (this.enPassantTarget && this.enPassantTarget.row === row + dir && this.enPassantTarget.col === nc) {
                            addMove(row + dir, nc, 'ep');
                        }
                    }
                }
                break;
            }
            
            case PIECES.KNIGHT: {
                const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
                for (const [dr, dc] of knightMoves) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                        const target = this.board[nr][nc];
                        if (!target || target.color === enemyColor) {
                            addMove(nr, nc);
                        }
                    }
                }
                break;
            }
            
            case PIECES.KING: {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = row + dr, nc = col + dc;
                        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            const target = this.board[nr][nc];
                            if (!target || target.color === enemyColor) {
                                addMove(nr, nc);
                            }
                        }
                    }
                }
                
                // Castling
                if (checkLegal && !this.isInCheck(color)) {
                    const rank = color === COLORS.WHITE ? 0 : 7;
                    if (row === rank && col === 4) {
                        // Kingside
                        const ksRight = color === COLORS.WHITE ? 'wK' : 'bK';
                        if (this.castlingRights[ksRight] && 
                            !this.board[rank][5] && !this.board[rank][6] &&
                            this.board[rank][7]?.type === PIECES.ROOK &&
                            !this.isAttacked(rank, 5, enemyColor) && !this.isAttacked(rank, 6, enemyColor)) {
                            addMove(rank, 6, 'castle-k');
                        }
                        
                        // Queenside
                        const qsRight = color === COLORS.WHITE ? 'wQ' : 'bQ';
                        if (this.castlingRights[qsRight] && 
                            !this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1] &&
                            this.board[rank][0]?.type === PIECES.ROOK &&
                            !this.isAttacked(rank, 3, enemyColor) && !this.isAttacked(rank, 2, enemyColor)) {
                            addMove(rank, 2, 'castle-q');
                        }
                    }
                }
                break;
            }
            
            // Sliding pieces
            default: {
                let directions = [];
                if (piece.type === PIECES.ROOK || piece.type === PIECES.QUEEN) {
                    directions.push([0,1],[0,-1],[1,0],[-1,0]);
                }
                if (piece.type === PIECES.BISHOP || piece.type === PIECES.QUEEN) {
                    directions.push([1,1],[1,-1],[-1,1],[-1,-1]);
                }
                
                for (const [dr, dc] of directions) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        const target = this.board[r][c];
                        if (!target) {
                            addMove(r, c);
                        } else {
                            if (target.color === enemyColor) addMove(r, c);
                            break;
                        }
                        r += dr;
                        c += dc;
                    }
                }
                break;
            }
        }
        
        return moves;
    }
    
    // Generate all legal moves for a color
    getAllMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    moves.push(...this.generateMoves(r, c));
                }
            }
        }
        return moves;
    }
    
    // Make a move on the board
    makeMove(move) {
        const { from, to, special } = move;
        const piece = this.board[from.row][from.col];
        const captured = this.board[to.row][to.col];
        
        // Record move for undo
        move.piece = piece;
        move.captured = captured;
        move.castlingBefore = {...this.castlingRights};
        move.epBefore = this.enPassantTarget;
        move.halfMoveBefore = this.halfMoveClock;
        
        // Execute move
        this.board[to.row][to.col] = piece;
        this.board[from.row][from.col] = null;
        
        // Handle special moves
        if (special === 'ep') {
            this.board[from.row][to.col] = null;
        } else if (special === 'castle-k') {
            this.board[to.row][5] = this.board[to.row][7];
            this.board[to.row][7] = null;
        } else if (special === 'castle-q') {
            this.board[to.row][3] = this.board[to.row][0];
            this.board[to.row][0] = null;
        } else if (special === 'promotion') {
            this.board[to.row][to.col] = { type: PIECES.QUEEN, color: piece.color };
        }
        
        // Update castling rights
        if (piece.type === PIECES.KING) {
            if (piece.color === COLORS.WHITE) {
                this.castlingRights.wK = false;
                this.castlingRights.wQ = false;
            } else {
                this.castlingRights.bK = false;
                this.castlingRights.bQ = false;
            }
        }
        if (piece.type === PIECES.ROOK) {
            if (from.row === 0 && from.col === 0) this.castlingRights.wQ = false;
            if (from.row === 0 && from.col === 7) this.castlingRights.wK = false;
            if (from.row === 7 && from.col === 0) this.castlingRights.bQ = false;
            if (from.row === 7 && from.col === 7) this.castlingRights.bK = false;
        }
        
        // Update en passant target
        if (special === 'double') {
            this.enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
        } else {
            this.enPassantTarget = null;
        }
        
        // Update clocks
        if (piece.type === PIECES.PAWN || captured) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }
        
        if (piece.color === COLORS.BLACK) this.fullMoveNumber++;
        
        // Record captured piece
        if (captured) {
            this.capturedPieces[captured.color].push(captured);
        }
        
        // Switch turn
        this.turn = this.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
        this.lastMove = move;
        this.moveHistory.push(move);
        
        return captured;
    }
    
    // Undo the last move
    undoMove() {
        if (this.moveHistory.length === 0) return null;
        
        const move = this.moveHistory.pop();
        const { from, to, piece, captured, special, castlingBefore, epBefore, halfMoveBefore } = move;
        
        // Restore piece
        this.board[from.row][from.col] = piece;
        this.board[to.row][to.col] = captured;
        
        // Undo special moves
        if (special === 'ep') {
            this.board[from.row][to.col] = { type: PIECES.PAWN, color: this.turn };
        } else if (special === 'castle-k') {
            this.board[to.row][7] = this.board[to.row][5];
            this.board[to.row][5] = null;
        } else if (special === 'castle-q') {
            this.board[to.row][0] = this.board[to.row][3];
            this.board[to.row][3] = null;
        }
        
        // Restore state
        this.castlingRights = castlingBefore;
        this.enPassantTarget = epBefore;
        this.halfMoveClock = halfMoveBefore;
        this.turn = piece.color;
        this.lastMove = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
        
        if (piece.color === COLORS.BLACK) this.fullMoveNumber--;
        
        // Remove from captured
        if (captured) {
            this.capturedPieces[captured.color].pop();
        }
        
        return move;
    }
    
    // Check for checkmate or stalemate
    getGameState() {
        const moves = this.getAllMoves(this.turn);
        if (moves.length === 0) {
            if (this.isInCheck(this.turn)) {
                return 'checkmate';
            }
            return 'stalemate';
        }
        
        if (this.isInCheck(this.turn)) {
            return 'check';
        }
        
        // Draw conditions
        if (this.halfMoveClock >= 100) return 'draw-50';
        
        return 'playing';
    }
}

// ============================================================
// AI ENGINE - Minimax with Alpha-Beta Pruning
// ============================================================

class ChessAI {
    constructor(depth = 3) {
        this.maxDepth = depth;
        this.nodesSearched = 0;
        
        // Piece values
        this.values = {
            P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000
        };
        
        // Piece-square tables (simplified)
        this.pst = {
            P: [
                [0,  0,  0,  0,  0,  0,  0,  0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5,  5, 10, 25, 25, 10,  5,  5],
                [0,  0,  0, 20, 20,  0,  0,  0],
                [5, -5,-10,  0,  0,-10, -5,  5],
                [5, 10, 10,-20,-20, 10, 10,  5],
                [0,  0,  0,  0,  0,  0,  0,  0]
            ],
            N: [
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ]
        };
    }
    
    evaluate(game) {
        let score = 0;
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = game.board[r][c];
                if (piece) {
                    let value = this.values[piece.type];
                    
                    // Add positional bonus
                    if (this.pst[piece.type]) {
                        const pstRow = piece.color === COLORS.WHITE ? r : 7 - r;
                        value += this.pst[piece.type][pstRow][c];
                    }
                    
                    if (piece.color === COLORS.WHITE) {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }
        
        return score;
    }
    
    minimax(game, depth, alpha, beta, maximizing) {
        this.nodesSearched++;
        
        if (depth === 0) {
            return this.evaluate(game);
        }
        
        const moves = game.getAllMoves(maximizing ? COLORS.WHITE : COLORS.BLACK);
        
        if (moves.length === 0) {
            if (game.isInCheck(maximizing ? COLORS.WHITE : COLORS.BLACK)) {
                return maximizing ? -99999 + (this.maxDepth - depth) : 99999 - (this.maxDepth - depth);
            }
            return 0; // Stalemate
        }
        
        // Move ordering: captures first
        moves.sort((a, b) => {
            const aCap = a.captured ? this.values[a.captured.type] : 0;
            const bCap = b.captured ? this.values[b.captured.type] : 0;
            return bCap - aCap;
        });
        
        if (maximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                game.makeMove(move);
                const eval_ = this.minimax(game, depth - 1, alpha, beta, false);
                game.undoMove();
                
                maxEval = Math.max(maxEval, eval_);
                alpha = Math.max(alpha, eval_);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                game.makeMove(move);
                const eval_ = this.minimax(game, depth - 1, alpha, beta, true);
                game.undoMove();
                
                minEval = Math.min(minEval, eval_);
                beta = Math.min(beta, eval_);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }
    
    getBestMove(game) {
        this.nodesSearched = 0;
        const moves = game.getAllMoves(COLORS.BLACK);
        
        if (moves.length === 0) return null;
        
        let bestMove = moves[0];
        let bestValue = Infinity;
        
        // Move ordering
        moves.sort((a, b) => {
            const aCap = a.captured ? this.values[a.captured.type] : 0;
            const bCap = b.captured ? this.values[b.captured.type] : 0;
            return bCap - aCap;
        });
        
        for (const move of moves) {
            game.makeMove(move);
            const value = this.minimax(game, this.maxDepth - 1, -Infinity, Infinity, true);
            game.undoMove();
            
            if (value < bestValue) {
                bestValue = value;
                bestMove = move;
            }
        }
        
        console.log(`AI searched ${this.nodesSearched} nodes`);
        return bestMove;
    }
}

// ============================================================
// UI CONTROLLER
// ============================================================

class ChessUI {
    constructor() {
        this.game = new ChessGame();
        this.ai = new ChessAI(3);
        this.boardEl = document.getElementById('board');
        this.statusEl = document.getElementById('status');
        this.capturedWhiteEl = document.getElementById('captured-white');
        this.capturedBlackEl = document.getElementById('captured-black');
        
        this.renderBoard();
        this.updateStatus();
        this.setupEventListeners();
    }
    
    renderBoard() {
        this.boardEl.innerHTML = '';
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = r;
                square.dataset.col = c;
                
                // Highlight last move
                if (this.game.lastMove) {
                    if ((r === this.game.lastMove.from.row && c === this.game.lastMove.from.col) ||
                        (r === this.game.lastMove.to.row && c === this.game.lastMove.to.col)) {
                        square.classList.add('last-move');
                    }
                }
                
                // Highlight selected square
                if (this.selectedSquare && this.selectedSquare.row === r && this.selectedSquare.col === c) {
                    square.classList.add('selected');
                }
                
                // Highlight valid moves
                if (this.validMoves.some(m => m.to.row === r && m.to.col === c)) {
                    square.classList.add('valid-move');
                }
                
                // Render piece
                const piece = this.game.board[r][c];
                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = `piece ${piece.color === COLORS.WHITE ? 'white-piece' : 'black-piece'}`;
                    pieceEl.textContent = SYMBOLS[`${piece.color}${piece.type}`];
                    square.appendChild(pieceEl);
                }
                
                this.boardEl.appendChild(square);
            }
        }
        
        this.updateCaptured();
    }
    
    updateStatus() {
        const state = this.game.getGameState();
        
        if (state === 'checkmate') {
            const winner = this.game.turn === COLORS.WHITE ? 'Black' : 'White';
            this.statusEl.textContent = `Checkmate! ${winner} wins!`;
            this.game.gameOver = true;
        } else if (state === 'stalemate') {
            this.statusEl.textContent = 'Stalemate! Draw.';
            this.game.gameOver = true;
        } else if (state === 'check') {
            this.statusEl.textContent = `${this.game.turn === COLORS.WHITE ? 'White' : 'Black'} is in check!`;
        } else if (state === 'draw-50') {
            this.statusEl.textContent = 'Draw by 50-move rule.';
            this.game.gameOver = true;
        } else {
            this.statusEl.textContent = `${this.game.turn === COLORS.WHITE ? 'White' : 'Black'} to move`;
        }
    }
    
    updateCaptured() {
        this.capturedWhiteEl.innerHTML = this.game.capturedPieces[COLORS.WHITE]
            .map(p => `<span class="piece black-piece">${SYMBOLS[`b${p.type}`]}</span>`).join('');
        this.capturedBlackEl.innerHTML = this.game.capturedPieces[COLORS.BLACK]
            .map(p => `<span class="piece white-piece">${SYMBOLS[`w${p.type}`]}</span>`).join('');
    }
    
    setupEventListeners() {
        // Square clicks
        this.boardEl.addEventListener('click', (e) => {
            if (this.game.gameOver || this.game.turn !== COLORS.WHITE) return;
            
            const square = e.target.closest('.square');
            if (!square) return;
            
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            
            this.handleSquareClick(row, col);
        });
        
        // New game button
        document.getElementById('new-game').addEventListener('click', () => {
            this.game = new ChessGame();
            this.selectedSquare = null;
            this.validMoves = [];
            this.renderBoard();
            this.updateStatus();
        });
        
        // Undo button
        document.getElementById('undo').addEventListener('click', () => {
            if (this.game.moveHistory.length >= 2 && !this.game.gameOver) {
                this.game.undoMove(); // Undo AI move
                this.game.undoMove(); // Undo player move
                this.selectedSquare = null;
                this.validMoves = [];
                this.renderBoard();
                this.updateStatus();
            }
        });
        
        // Difficulty selector
        document.getElementById('difficulty').addEventListener('change', (e) => {
            this.ai.maxDepth = parseInt(e.target.value);
        });
    }
    
    handleSquareClick(row, col) {
        const piece = this.game.board[row][col];
        
        // If clicking on a valid move destination
        if (this.selectedSquare && this.validMoves.some(m => m.to.row === row && m.to.col === col)) {
            this.executePlayerMove(row, col);
            return;
        }
        
        // If clicking on own piece, select it
        if (piece && piece.color === this.game.turn) {
            this.selectedSquare = { row, col };
            this.validMoves = this.game.generateMoves(row, col);
            this.renderBoard();
            return;
        }
        
        // Deselect
        this.selectedSquare = null;
        this.validMoves = [];
        this.renderBoard();
    }
    
    executePlayerMove(toRow, toCol) {
        const move = this.validMoves.find(m => m.to.row === toRow && m.to.col === toCol);
        if (!move) return;
        
        this.game.makeMove(move);
        this.selectedSquare = null;
        this.validMoves = [];
        this.renderBoard();
        this.updateStatus();
        
        // AI's turn
        if (!this.game.gameOver) {
            setTimeout(() => this.makeAIMove(), 300);
        }
    }
    
    makeAIMove() {
        const move = this.ai.getBestMove(this.game);
        if (move) {
            this.game.makeMove(move);
            this.renderBoard();
            this.updateStatus();
        }
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

let chessUI;

function init() {
    try {
        chessUI = new ChessUI();
    } catch (e) {
        console.error("Initialization failed:", e);
        const board = document.getElementById('board');
        if (board) {
            board.innerHTML = '<div style="grid-column: 1/-1; display: flex; justify-content: center; align-items: center; height: 100%; color: #ff5577; text-align: center; padding: 20px;">Error loading game.<br><br>' + e.message + '</div>';
        }
    }
}

// Run immediately if DOM is ready, otherwise wait for load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
