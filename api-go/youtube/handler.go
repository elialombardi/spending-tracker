package youtube

import (
	"strconv"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {

	group := app.Group("/api/youtube", authMiddleware.Authenticate)

	// Channel routes
	group.Get("/channels", h.GetChannels)
	group.Get("/channels/untagged", h.GetUntaggedChannels)
	group.Get("/channels/:id", h.GetChannel)
	group.Post("/channels/:id/tags", h.AddTagsToChannel)
	group.Delete("/channels/:id/tags", h.RemoveTagsFromChannel)

	// Tag routes
	group.Get("/tags", h.GetTags)
	group.Post("/tags", h.CreateTag)
	group.Put("/tags/:id", h.UpdateTag)
	group.Delete("/tags/:id", h.DeleteTag)

	// Video routes
	group.Get("/videos/latest", h.GetLatestVideos)
	group.Get("/videos/tag/:tagId", h.GetLatestVideosForTag)

	// Sync routes
	group.Post("/sync", h.SyncAll)
	group.Post("/sync/channel/:id", h.SyncChannel)
	group.Post("/sync/tag/:tagId", h.SyncTagChannels)
	group.Get("/sync/status", h.GetSyncStatus)
}

func (h *Handler) getUserID(c fiber.Ctx) (uint, error) {
	userID, ok := c.Locals(user.UserIDKey).(uint)
	if !ok {
		return 0, fiber.ErrUnauthorized
	}
	return userID, nil
}

func (h *Handler) GetChannels(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	includeVideos := c.Query("includeVideos") == "true"
	limit, _ := strconv.Atoi(c.Query("limit", "0"))

	channels, err := h.service.GetUserChannels(userID, includeVideos, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch channels",
		})
	}

	response := make([]ChannelResponse, len(channels))
	for i, channel := range channels {
		response[i] = h.toChannelResponse(&channel, includeVideos)
	}

	return c.JSON(response)
}

func (h *Handler) GetUntaggedChannels(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	channels, err := h.service.GetUntaggedChannels(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch untagged channels",
		})
	}

	response := make([]ChannelResponse, len(channels))
	for i, channel := range channels {
		response[i] = h.toChannelResponse(&channel, false)
	}

	return c.JSON(response)
}

func (h *Handler) GetChannel(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	channelIDstring := c.Params("id")
	channelID, err := strconv.ParseUint(channelIDstring, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid channel ID",
		})
	}

	channel, err := h.service.GetChannelByID(uint(channelID), userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Channel not found",
		})
	}

	return c.JSON(h.toChannelResponse(channel, true))
}

func (h *Handler) AddTagsToChannel(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	channelIDstring := c.Params("id")
	channelID, err := strconv.ParseUint(channelIDstring, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid channel ID",
		})
	}

	var req AddTagsRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.AddTagsToChannel(uint(channelID), userID, req.TagIDs); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Tags added successfully",
	})
}

func (h *Handler) RemoveTagsFromChannel(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	channelIDstring := c.Params("id")
	channelID, err := strconv.ParseUint(channelIDstring, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid channel ID",
		})
	}

	var req RemoveTagsRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.RemoveTagsFromChannel(uint(channelID), userID, req.TagIDs); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Tags removed successfully",
	})
}

func (h *Handler) GetTags(c fiber.Ctx) error {
	tags, err := h.service.GetTags()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch tags",
		})
	}

	response := make([]TagResponse, len(tags))
	for i, tag := range tags {
		response[i] = h.toTagResponse(&tag)
	}

	return c.JSON(response)
}

func (h *Handler) CreateTag(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	var req CreateTagRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Name is required",
		})
	}

	tag, err := h.service.CreateTag(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create tag",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(h.toTagResponse(tag))
}

func (h *Handler) UpdateTag(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	tagIDstring := c.Params("id")
	tagID, err := strconv.ParseUint(tagIDstring, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid tag ID",
		})
	}

	var req UpdateTagRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	tag, err := h.service.UpdateTag(uint(tagID), userID, req)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Tag not found",
		})
	}

	return c.JSON(h.toTagResponse(tag))
}

func (h *Handler) DeleteTag(c fiber.Ctx) error {
	tagIDstring := c.Params("id")

	if err := h.service.DeleteTag(tagIDstring); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Tag not found",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Tag deleted successfully",
	})
}

func (h *Handler) GetLatestVideos(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if limit > 100 {
		limit = 100
	}

	videos, err := h.service.GetLatestVideosForUser(userID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch latest videos",
		})
	}

	response := make([]VideoResponse, len(videos))
	for i, video := range videos {
		response[i] = h.toVideoResponse(&video)
	}

	return c.JSON(response)
}

func (h *Handler) GetLatestVideosForTag(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	tagID := c.Params("tagId")
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if limit > 100 {
		limit = 100
	}

	videos, err := h.service.GetLatestVideosForTag(userID, tagID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch videos for tag",
		})
	}

	response := make([]VideoResponse, len(videos))
	for i, video := range videos {
		response[i] = h.toVideoResponse(&video)
	}

	return c.JSON(response)
}

func (h *Handler) SyncAll(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	syncLog, err := h.service.SyncAllSubscribedChannels(userID)
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message": "Sync started",
		"syncId":  syncLog.ID,
	})
}

func (h *Handler) SyncChannel(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	channelID := c.Params("id")

	syncLog, err := h.service.SyncChannel(userID, channelID)
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message": "Sync started",
		"syncId":  syncLog.ID,
	})
}

func (h *Handler) SyncTagChannels(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	tagID := c.Params("tagId")

	syncLog, err := h.service.SyncTagChannels(userID, tagID)
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message": "Sync started",
		"syncId":  syncLog.ID,
	})
}

func (h *Handler) GetSyncStatus(c fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	status, err := h.service.GetSyncStatus(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get sync status",
		})
	}

	return c.JSON(status)
}

// Helper functions for converting models to responses
func (h *Handler) toChannelResponse(channel *YoutubeChannel, includeVideos bool) ChannelResponse {
	resp := ChannelResponse{
		ID:              channel.ID,
		Name:            channel.Name,
		Description:     channel.Description,
		Thumbnail:       channel.Thumbnail,
		SubscriberCount: channel.SubscriberCount,
		VideoCount:      channel.VideoCount,
		ViewCount:       channel.ViewCount,
		CustomURL:       channel.CustomURL,
		Country:         channel.Country,
		LastSyncedAt:    channel.LastSyncedAt,
	}

	// Tags
	if channel.Tags != nil {
		tags := make([]TagResponse, len(channel.Tags))
		for i, tag := range channel.Tags {
			tags[i] = h.toTagResponse(&tag)
		}
		resp.Tags = tags
	}

	// Videos
	if includeVideos && channel.Videos != nil {
		videos := make([]VideoResponse, len(channel.Videos))
		for i, video := range channel.Videos {
			videos[i] = h.toVideoResponse(&video)
		}
		resp.RecentVideos = videos
	}

	return resp
}

func (h *Handler) toVideoResponse(video *YoutubeVideo) VideoResponse {
	return VideoResponse{
		ID:          video.ID,
		Title:       video.Title,
		Description: video.Description,
		Thumbnail:   video.Thumbnail,
		PublishedAt: video.PublishedAt,
		Duration:    video.Duration,
		ViewCount:   video.ViewCount,
		URL:         video.URL,
	}
}

func (h *Handler) toTagResponse(tag *Tag) TagResponse {
	return TagResponse{
		ID:           tag.ID,
		Name:         tag.Name,
		Description:  tag.Description,
		Color:        tag.Color,
		ChannelCount: len(tag.Channels),
	}
}
