package raytracer

import (
	"fmt"
	"math"
)

type Vector3 struct {
	X, Y, Z float64
}

func (v Vector3) Add(other Vector3) Vector3 {
	return Vector3{v.X + other.X, v.Y + other.Y, v.Z + other.Z}
}

func (v Vector3) Subtract(other Vector3) Vector3 {
	return Vector3{v.X - other.X, v.Y - other.Y, v.Z - other.Z}
}

func (v Vector3) Multiply(scalar float64) Vector3 {
	return Vector3{v.X * scalar, v.Y * scalar, v.Z * scalar}
}

func (v Vector3) Divide(scalar float64) Vector3 {
	return Vector3{v.X / scalar, v.Y / scalar, v.Z / scalar}
}

func (v Vector3) Dot(other Vector3) float64 {
	return v.X*other.X + v.Y*other.Y + v.Z*other.Z
}

func (v Vector3) Cross(other Vector3) Vector3 {
	return Vector3{
		v.Y*other.Z - v.Z*other.Y,
		v.Z*other.X - v.X*other.Z,
		v.X*other.Y - v.Y*other.X,
	}
}

func (v Vector3) HadamardProduct(other Vector3) Vector3 {
	return Vector3{v.X * other.X, v.Y * other.Y, v.Z * other.Z}
}

func (v Vector3) Lerp(other Vector3, t float64) Vector3 {
	return v.Add(other.Subtract(v).Multiply(t))
}

func (v Vector3) Clamp(min, max float64) Vector3 {
	return Vector3{
		math.Max(min, math.Min(max, v.X)),
		math.Max(min, math.Min(max, v.Y)),
		math.Max(min, math.Min(max, v.Z)),
	}
}

func (v Vector3) Magnitude() float64 {
	return math.Sqrt(v.X*v.X + v.Y*v.Y + v.Z*v.Z)
}

func (v Vector3) Normalize() Vector3 {
	return v.Divide(v.Magnitude())
}

func (v Vector3) NormalizeTo(length float64) Vector3 {
	return v.Normalize().Multiply(length)
}

func (v Vector3) String() string {
	return fmt.Sprintf("X: %f, Y: %f, Z: %f", v.X, v.Y, v.Z)
}
