import React, { useEffect, useRef } from "react";

const LessonPlayer = ({ videoId, onLessonComplete }) => {
  const playerRef = useRef(null);
  
  // 🔒 Безопасный videoId - только буквы, цифры, дефисы и подчеркивания
  const safeVideoId = (videoId || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 20);
  const iframeId = `yt-player-${safeVideoId}`;

  // 🔒 Безопасный callback
  const safeOnComplete = React.useCallback(() => {
    if (typeof onLessonComplete === 'function') {
      try {
        onLessonComplete();
      } catch (error) {
        console.error('Lesson complete error:', error);
      }
    }
  }, [onLessonComplete]);

  useEffect(() => {
    // 🔒 Проверка наличия videoId
    if (!safeVideoId) {
      console.error('Invalid video ID');
      return;
    }

    // load YT API if not present
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => console.error('Failed to load YouTube API');
      document.body.appendChild(tag);
    }

    let player;
    const createPlayer = () => {
      if (playerRef.current || !window.YT || !window.YT.Player) return;
      
      try {
        player = new window.YT.Player(iframeId, {
          events: {
            onReady: (event) => {
            },
            onStateChange: (e) => {
              // e.data values: -1(unstarted), 0(ended), 1(playing), 2(paused)...
              if (e.data === window.YT.PlayerState.ENDED) {
                // video ended — notify parent
                safeOnComplete();
              }
            },
            onError: (error) => {
              console.error('YouTube player error:', error);
            }
          },
          playerVars: {
            enablejsapi: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin, // 🔒 Безопасность CORS
            widget_referrer: window.location.origin // 🔒 Безопасность
          },
        });
        playerRef.current = player;
      } catch (error) {
        console.error('Failed to create YouTube player:', error);
      }
    };

    // If API ready already
    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      // wait until API ready
      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    }

    return () => {
      // cleanup
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error('Error destroying player:', error);
        }
        playerRef.current = null;
      }
      
      // 🔒 Очистка глобальной функции
      if (window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady = null;
      }
    };
  }, [safeVideoId, safeOnComplete, iframeId]);

  // 🔒 Проверка на валидный videoId
  if (!safeVideoId) {
    return (
      <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <p className="text-gray-500">Video not available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="video-wrapper" style={{ aspectRatio: "16/9" }}>
        <div id={iframeId}>
          <iframe
            id={`${iframeId}-frame`}
            title="YouTube video"
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${safeVideoId}?enablejsapi=1&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`}
            frameBorder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%" }}
            loading="lazy"
            // 🔒 Безопасность iframe
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      </div>
    </div>
  );
};

export default LessonPlayer;