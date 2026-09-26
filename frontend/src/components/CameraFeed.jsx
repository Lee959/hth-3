export default function CameraFeed({ videoRef }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/20 bg-black/40 shadow-lg backdrop-blur-xl">
      <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
    </div>
  )
}
