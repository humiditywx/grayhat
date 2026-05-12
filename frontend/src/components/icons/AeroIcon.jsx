export default function AeroIcon({
  name,
  size = 20,
  title,
  className = '',
  style,
  ...props
}) {
  const iconMap = {
    add: 'add',
    attach: 'attach_file',
    back: 'arrow_back_ios',
    camera: 'photo_camera',
    chat: 'chat_bubble',
    check: 'check',
    close: 'close',
    copy: 'content_copy',
    deleted: 'delete',
    display: 'desktop_windows',
    edit: 'edit',
    eye: 'visibility',
    file: 'insert_drive_file',
    globe: 'language',
    groupAdd: 'group_add',
    hangup: 'call_end',
    info: 'info',
    lock: 'lock',
    mic: 'mic',
    micMuted: 'mic_off',
    moon: 'dark_mode',
    people: 'group',
    phone: 'call',
    play: 'play_arrow',
    pause: 'pause',
    qr: 'qr_code_scanner',
    reply: 'reply',
    search: 'search',
    send: 'send',
    settings: 'settings',
    share: 'share',
    shield: 'security',
    speaker: 'volume_up',
    speakerOff: 'volume_off',
    story: 'amp_stories',
    sun: 'light_mode',
    trash: 'delete',
    upload: 'upload',
    video: 'videocam',
  }

  const materialName = iconMap[name] || name || 'help_outline'

  return (
    <span
      className={`material-icons-outlined aero-icon ${className}`.trim()}
      style={{ fontSize: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {materialName}
    </span>
  )
}
