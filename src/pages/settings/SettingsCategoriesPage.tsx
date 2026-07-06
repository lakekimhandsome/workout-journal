import { SubpageLayout } from '../../components/SubpageLayout'
import { useJournal } from '../../context/JournalProvider'
import { paths } from '../../routes/paths'
import type { Category } from '../../lib/journal'

export function SettingsCategoriesPage() {
  const {
    categories,
    sessions,
    newCategoryName,
    setNewCategoryName,
    newCategoryColor,
    setNewCategoryColor,
    createCategory,
    updateCategory,
    removeCategory,
    PALETTE,
  } = useJournal()

  return (
    <SubpageLayout
      title="카테고리 수정하기"
      backLabel="설정으로"
      backTo={paths.settings.root}
    >
      <section className="category-card">
        <div className="section-title">
          <h2>카테고리</h2>
          <span>세션에서 사용할 이름과 색상</span>
        </div>

        <form className="category-form" onSubmit={createCategory}>
          <div className="category-form-fields">
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="PUSH, 상체, Day 1..."
              aria-label="새 카테고리 이름"
            />
            <div className="palette" aria-label="카테고리 색상 선택">
              {PALETTE.map((color: string) => (
                <button
                  key={color}
                  className={color === newCategoryColor ? 'swatch selected' : 'swatch'}
                  type="button"
                  style={{ background: color }}
                  onClick={() => setNewCategoryColor(color)}
                  aria-label={`${color} 선택`}
                />
              ))}
            </div>
          </div>
          <button type="submit">추가</button>
        </form>

        <div className="category-list">
          {categories.map((category: Category) => {
            const isUsed = sessions.some(
              (session: { categoryId: string }) => session.categoryId === category.id,
            )

            return (
              <div className="category-item" key={category.id}>
                <input
                  type="color"
                  value={category.color}
                  onChange={(event) => updateCategory(category.id, { color: event.target.value })}
                  aria-label={`${category.name} 색상`}
                />
                <input
                  value={category.name}
                  onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                  aria-label={`${category.name} 이름`}
                />
                <button
                  type="button"
                  disabled={isUsed || categories.length <= 1}
                  onClick={() => removeCategory(category.id)}
                >
                  삭제
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </SubpageLayout>
  )
}
