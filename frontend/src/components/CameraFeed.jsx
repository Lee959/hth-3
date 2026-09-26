export default function CameraFeed({ videoRef }) {
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="aspect-video w-full rounded-2xl bg-black object-cover"
    />
  )
}
