package raytracer

import (
	"image"
	"image/color"
	"image/png"
	"math"
	"os"

	"github.com/kevin-cantwell/dotmatrix"
)

const SPHERE_RADIUS float64 = 1.5
const WIDTH int = 640 / 2
const HEIGHT int = 480 / 2
const FOV float64 = math.Pi / 3
const EPS = 0.1
const NOISE_AMPLITUDE = 1.0
const NOISE_OCTAVES = 3.4
const DISPLACEMENT_SCALE = 16.

func run() {
	camera := Camera{Vector3{0, 0, 3}}
	light := Light{.4, Vector3{10, 10, 10}}

	frameBuffer := make([]Vector3, HEIGHT*WIDTH)
	width := float64(WIDTH)
	height := float64(HEIGHT)
	for i := 0; i < HEIGHT; i++ {
		for j := 0; j < WIDTH; j++ {
			dirX := (float64(j) + 0.5) - width/2
			dirY := -(float64(i) + 0.5) + height/2
			dirZ := -height / (2 * math.Tan(FOV/2))

			dir := Vector3{dirX, dirY, dirZ}.Normalize()
			hit, hitPos := sphereTrace(camera.position, dir)

			color := Vector3{0.2, 0.7, 0.8}
			if hit {
				normal := distanceFieldNormal(hitPos)
				intensity := light.LightIntensityAt(hitPos, normal)
				noiseLevel := (SPHERE_RADIUS - hitPos.Magnitude()) / NOISE_AMPLITUDE
				color = fireColor((-.2 + noiseLevel) * 2.).Multiply(intensity)
			}
			frameBuffer[i*WIDTH+j] = color.Clamp(0, 1)
		}
	}
	println("Writing to image")
	img := frameBufferToImage(frameBuffer)
	writeImageToFile(img, "out.png")
	printImageAsAscii(img)
}

func fireColor(d float64) Vector3 {
	yellow := Vector3{1.7, 1.6, 1.0}
	orange := Vector3{1.0, 0.6, 0.0}
	red := Vector3{1.0, 0.0, 0.0}
	darkgray := Vector3{0.2, 0.2, 0.2}
	gray := Vector3{0.4, 0.4, 0.4}

	x := math.Max(0., math.Min(1., d))

	if x < .25 {
		return gray.Lerp(darkgray, x*4.)
	}
	if x < .5 {
		return darkgray.Lerp(red, x*4.-1.)
	}
	if x < .75 {
		return red.Lerp(orange, x*4.-2.)
	}
	return orange.Lerp(yellow, x*4.-3.)
}

func signedDistance(pos Vector3) float64 {
	// posOnSphere := pos.NormalizeTo(SPHERE_RADIUS)
	displacement := -fractalBrownianMotion(pos.Multiply(NOISE_OCTAVES)) * NOISE_AMPLITUDE
	return pos.Magnitude() - SPHERE_RADIUS - displacement
}

func distanceFieldNormal(pos Vector3) Vector3 {
	d := signedDistance(pos)
	dX := signedDistance(pos.Add(Vector3{EPS, 0, 0})) - d
	dY := signedDistance(pos.Add(Vector3{0, EPS, 0})) - d
	dZ := signedDistance(pos.Add(Vector3{0, 0, EPS})) - d
	return Vector3{dX, dY, dZ}.Normalize()
}

func sphereTrace(origin Vector3, dir Vector3) (bool, Vector3) {
	if (origin.Dot(origin) - math.Pow(origin.Dot(dir), 2)) > math.Pow(SPHERE_RADIUS, 2) {
		return false, origin
	}
	pos := origin
	for i := 0; i < 100; i++ {
		d := signedDistance(pos)
		if d < 0 {
			return true, pos
		}
		pos = pos.Add(dir.Multiply(math.Max(d*0.1, 0.01)))
	}
	return false, pos
}

func frameBufferToImage(frameBuffer []Vector3) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, WIDTH, HEIGHT))

	for i := 0; i < HEIGHT; i++ {
		for j := 0; j < WIDTH; j++ {
			color := color.RGBA{
				R: uint8(frameBuffer[j+i*WIDTH].X * 255),
				G: uint8(frameBuffer[j+i*WIDTH].Y * 255),
				B: uint8(frameBuffer[j+i*WIDTH].Z * 255),
				A: 255,
			}
			img.Set(j, i, color)
		}
	}
	return img
}

func writeImageToFile(img *image.RGBA, filename string) {
	file, err := os.Create(filename)
	if err != nil {
		panic(err)
	}
	defer file.Close()

	err = png.Encode(file, img)
	if err != nil {
		panic(err)
	}
}

func printImageAsAscii(img *image.RGBA) {
	dotmatrix.Print(os.Stdout, img)
}
