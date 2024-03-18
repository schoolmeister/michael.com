package raytracer

import "math"

type Light struct {
	intensity float64
	position  Vector3
}

type Camera struct {
	position Vector3
}

func (light Light) LightIntensityAt(pos Vector3, posNormal Vector3) float64 {
	lightDir := light.position.Subtract(pos).Normalize()
	return math.Max(lightDir.Dot(posNormal), light.intensity)
}
