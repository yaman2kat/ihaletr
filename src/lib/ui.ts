// Textarea'yı içerik uzadıkça aşağı doğru büyütür (scrollbar yerine).
// onInput'a doğrudan bağlanır: autoResizeTextarea bir React değişiklik
// olayı değil, native input event bekler.
export function autoResizeTextarea(e: { currentTarget: HTMLTextAreaElement }) {
  const el = e.currentTarget;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
