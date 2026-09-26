export default function CameraFeed({ videoRef }) {
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 h-full w-full bg-black object-cover"
    />
  )
}
