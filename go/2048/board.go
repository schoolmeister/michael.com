package game2048

import (
	"errors"
	"fmt"
	"math/rand"
)

type board struct {
	orientation Direction
	cells       cells
}

type cells [4][4]int

type Coordinate struct {
	row int
	col int
}

func (b board) cols() int {
	return len(b.cells[0])
}

func (b board) rows() int {
	return len(b.cells)
}

func (b board) transform(coordinate Coordinate) Coordinate {
	/**
	Transform a coordinate given in orientation-layout to memory-layout and vice versa.
	**/
	switch b.orientation {
	case Right: // (0,1) -> (1,3)
		return Coordinate{coordinate.col, b.cols() - coordinate.row - 1}
	case Down: // (0,0) -> (3,3)
		return Coordinate{b.rows() - coordinate.row - 1, b.cols() - coordinate.col - 1}
	case Left: // (0,0) -> (3,0)
		return Coordinate{b.rows() - coordinate.col - 1, coordinate.row}
	default:
		return coordinate // UP (0,0) -> (0,0)
	}
}

func (b board) get(coordinate Coordinate) int {
	coordinate = b.transform(coordinate)
	return b.cells[coordinate.row][coordinate.col]
}

func (b *board) move(from Coordinate, to Coordinate) {
	from = b.transform(from)
	to = b.transform(to)

	valueFrom := b.cells[from.row][from.col]
	b.cells[from.row][from.col] = 0
	b.cells[to.row][to.col] += valueFrom
}

func (b *board) spawn() error {
	rows := rand.Perm(b.cols())
	col := rand.Perm(b.rows())

	for _, i := range rows {
		for _, j := range col {
			if b.cells[i][j] == 0 {
				b.cells[i][j] = 2
				return nil
			}
		}
	}
	return errors.New("could not spawn new cell")
}

func (b *board) orientTowards(orientation Direction) {
	b.orientation = orientation
}

func (b *board) neighbours(coordinate Coordinate) []Coordinate {
	coordinate = b.transform(coordinate)
	var neighbours []Coordinate
	if coordinate.row > 0 {
		neighbours = append(neighbours, Coordinate{coordinate.row - 1, coordinate.col})
	}
	if coordinate.row < b.rows()-1 {
		neighbours = append(neighbours, Coordinate{coordinate.row + 1, coordinate.col})
	}
	if coordinate.col > 0 {
		neighbours = append(neighbours, Coordinate{coordinate.row, coordinate.col - 1})
	}
	if coordinate.col < b.cols()-1 {
		neighbours = append(neighbours, Coordinate{coordinate.row, coordinate.col + 1})
	}
	return neighbours
}

func (b *board) MoveCells(move Direction) (int, bool) {
	b.orientTowards(move)
	destinations := [4]struct {
		row  int
		used bool
	}{
		{0, false}, {0, false}, {0, false}, {0, false},
	}
	score := 0
	moved := false

	for i := 0; i < b.rows(); i++ {
		for j := 0; j < b.cols(); j++ {
			pos := Coordinate{i, j}
			cellValue := b.get(pos)

			if cellValue == 0 {
				continue
			}

			destination := &destinations[j]
			newPos := Coordinate{destination.row, j}
			precedingDestination := Coordinate{destination.row - 1, j}

			if destination.row > 0 && !destination.used && b.get(precedingDestination) == cellValue {
				newPos = precedingDestination
				b.move(pos, newPos)
				score += b.get(newPos)
				destination.used = true
			} else {
				b.move(pos, newPos)
				destination.row++
				destination.used = false
			}

			if newPos != pos {
				moved = true
			}

		}
	}
	return score, moved
}

func (b *board) IsGameOver() bool {
	for i := 0; i < b.rows(); i++ {
		for j := 0; j < b.cols(); j++ {
			var cellValue = b.get(Coordinate{i, j})
			if cellValue == 0 {
				return false
			}
			for _, neighbour := range b.neighbours(Coordinate{i, j}) {
				if cellValue == b.cells[neighbour.row][neighbour.col] {
					return false
				}
			}
		}
	}
	return true
}

func (c *cells) String() string {
	var s string
	for _, row := range c {
		for _, cell := range row {
			s += fmt.Sprintf("%4d", cell)
		}
		s += "\n"
	}
	return s
}
