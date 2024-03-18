package game2048

import (
	"errors"
	"fmt"
	"os"

	"github.com/eiannone/keyboard"
)

func main() {
	game := New()
	interactive(&game)

}

func getMove() (Direction, error) {
	_, key, err := keyboard.GetKey()
	if err != nil {
		fmt.Println("Error reading key:", err)
		return Up, err
	}

	if key == keyboard.KeyEsc {
		fmt.Println("Exiting...")
		return Up, err
	}

	if key == keyboard.KeyArrowUp {
		return Up, nil
	} else if key == keyboard.KeyArrowDown {
		return Down, nil
	} else if key == keyboard.KeyArrowLeft {
		return Left, nil
	} else if key == keyboard.KeyArrowRight {
		return Right, nil
	}
	return Up, errors.New("Invalid key")
}

func interactive(game Game2048) {
	err := keyboard.Open()
	if err != nil {
		fmt.Println("Error opening keyboard:", err)
		os.Exit(1)
	}
	defer keyboard.Close()

	fmt.Println("Press the arrow keys (ESC to exit):")

	for {
		move, err := getMove()
		if err != nil {
			break
		}
		game.Move(move)
		fmt.Print(game.String())
	}
}

type Game2048 interface {
	Move(move Direction)
	String() string
}

type GameState struct {
	score      int
	status     status
	board      board
	history    []Direction
	randomSeed int
}

type Direction string

const (
	Up    Direction = "↑"
	Down  Direction = "↓"
	Left  Direction = "←"
	Right Direction = "→"
)

type status string

const (
	Running status = "running"
	Won     status = "won"
	Lost    status = "lost"
)

func NewWithBoardState(initialBoardState cells) GameState {
	return GameState{
		status: Running,
		score:  0,
		board: board{Up,
			initialBoardState,
		},
		history:    []Direction{},
		randomSeed: 0,
	}
}

func New() GameState {
	return NewWithBoardState(cells{
		{0, 0, 0, 0},
		{0, 0, 0, 0},
		{0, 0, 2, 0},
		{0, 0, 0, 0}})
}

func (g *GameState) Move(move Direction) {
	if g.status != Running {
		return
	}
	score, didMove := g.board.MoveCells(move)
	g.score += score
	if didMove {
		g.history = append(g.history, move)
		g.board.spawn()
	}
	if g.board.IsGameOver() {
		g.status = Lost
		fmt.Printf("Game over! Score: %d\n", g.score)
	}
}

func (g *GameState) String() string {
	var s string
	s += fmt.Sprintln("Board: ")
	s += fmt.Sprint(g.board.cells.String())
	s += fmt.Sprintf("History: %v\n", g.history)
	s += fmt.Sprintf("Score: %d\n", g.score)
	s += fmt.Sprintf("Status: %s\n", g.status)
	s += "------------------\n"
	return s
}
