package locations

type Location struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	Tags        []string `json:"tags"`
	Url         string   `json:"url,omitempty"`
	Lat         float64  `json:"lat"`
	Lng         float64  `json:"lng"`
	Description string   `json:"description,omitempty"`
}
