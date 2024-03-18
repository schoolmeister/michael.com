package raytracer

import "math"

func lerp(a, b, t float64) float64 {
	return a + (b-a)*math.Max(0., math.Min(1., t))
}

func hash(n float64) float64 {
	x := math.Sin(n) * 43758.5453
	return x - math.Floor(x)
}

func noise(x Vector3) float64 {
	p := Vector3{math.Floor(x.X), math.Floor(x.Y), math.Floor(x.Z)}
	f := x.Subtract(p)
	f = Vector3{3., 3., 3.}.Subtract(f.Multiply(2)).HadamardProduct(f).HadamardProduct(f)
	n := p.Dot(Vector3{1, 57, 113})

	return lerp(lerp(
		lerp(hash(n+0), hash(n+1), f.X),
		lerp(hash(n+57), hash(n+58), f.X), f.Y),
		lerp(
			lerp(hash(n+113), hash(n+114), f.X),
			lerp(hash(n+170), hash(n+171), f.X), f.Y), f.Z)
}

func rotate(v Vector3) Vector3 {
	v1 := Vector3{0.00, 0.80, 0.60}.Dot(v)
	v2 := Vector3{-0.80, 0.36, -0.48}.Dot(v)
	v3 := Vector3{-0.60, -0.48, 0.64}.Dot(v)
	return Vector3{v1, v2, v3}
}

func fractalBrownianMotion(x Vector3) float64 {
	p := rotate(x)
	f := 0.
	f += 0.5000 * noise(p)
	p = p.Multiply(2.32)
	f += 0.2500 * noise(p)
	p = p.Multiply(3.03)
	f += 0.1250 * noise(p)
	p = p.Multiply(2.61)
	f += 0.0625 * noise(p)
	return f / 0.9375
}
