'use client'

type PrintButtonProps = {
  label?: string
}

export default function PrintButton({ label = 'Print' }: PrintButtonProps) {
  const handlePrint = () => {
    const desktopPrint = window.packpro?.print
    if (typeof desktopPrint === 'function') {
      void desktopPrint().catch(() => {
        window.print()
      })
      return
    }
    window.print()
  }

  return (
    <button className="btn" type="button" onClick={handlePrint}>
      {label}
    </button>
  )
}
