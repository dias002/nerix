import { ArrowLeft, Check, Search, ShoppingBag, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  interiorCategories,
  type InteriorCatalogItem,
  type InteriorCategory,
} from "./interiorCatalogData";

type InteriorCatalogProps = {
  items: InteriorCatalogItem[];
  selectedIds: string[];
  maxSelected: number;
  error: string;
  onToggle: (id: string) => void;
  onDone: () => void;
};

type CategoryFilter = "Все" | InteriorCategory;

export default function InteriorCatalog({
  items,
  selectedIds,
  maxSelected,
  error,
  onToggle,
  onDone,
}: InteriorCatalogProps) {
  const [category, setCategory] = useState<CategoryFilter>("Все");
  const [search, setSearch] = useState("");
  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((item) => item.id === id)).filter(Boolean) as InteriorCatalogItem[],
    [items, selectedIds]
  );
  const visibleItems = useMemo(() => {
    const query = normalize(search);
    return items.filter((item) => {
      const matchesCategory = category === "Все" || item.category === category;
      const haystack = normalize(`${item.title} ${item.category} ${item.detail} ${item.prompt}`);
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [category, items, search]);
  const limitReached = selectedIds.length >= maxSelected;

  return (
    <section className="interior-catalog-page">
      <header className="interior-catalog-header">
        <div className="interior-catalog-header-inner">
          <button type="button" className="interior-catalog-back" onClick={onDone}>
            <ArrowLeft />
            <span>Интерьер</span>
          </button>
          <div className="interior-catalog-title">
            <span>Nomdu Objects</span>
            <strong>Каталог предметов</strong>
          </div>
          <button type="button" className="interior-catalog-done" onClick={onDone}>
            Готово
            <span>{selectedIds.length}</span>
          </button>
        </div>
      </header>

      <div className="interior-catalog-content">
        <section className="interior-catalog-hero">
          <img src="/app-covers/interior.webp" alt="" width="1152" height="928" />
          <div>
            <p>Коллекция для генерации</p>
            <h2>Соберите интерьер из реальных предметов</h2>
            <span>
              Выберите до {maxSelected} позиций. Названия, материалы и формы попадут в задание модели, а доступные
              предметные фото будут приложены как референсы.
            </span>
          </div>
          <dl>
            <div>
              <dt>{items.length}</dt>
              <dd>предметов</dd>
            </div>
            <div>
              <dt>{interiorCategories.length}</dt>
              <dd>категорий</dd>
            </div>
          </dl>
        </section>

        <section className="interior-catalog-tools" aria-label="Поиск и категории">
          <label className="interior-catalog-search">
            <Search />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Диван, свет, дерево..."
              aria-label="Найти предмет"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Очистить поиск">
                <X />
              </button>
            ) : null}
          </label>
          <div className="interior-catalog-categories" role="list" aria-label="Категории">
            {(["Все", ...interiorCategories] as CategoryFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "is-active" : ""}
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <div className="interior-catalog-section-head">
          <div>
            <p>{category === "Все" ? "Вся коллекция" : `#${category}`}</p>
            <h3>{visibleItems.length} предметов</h3>
          </div>
          <span>{selectedIds.length}/{maxSelected} выбрано</span>
        </div>

        {error ? <p className="interior-catalog-error" role="alert">{error}</p> : null}
        {limitReached ? (
          <p className="interior-catalog-limit">
            Лимит заполнен. Уберите один предмет, чтобы выбрать другой.
          </p>
        ) : null}

        {visibleItems.length ? (
          <div className="interior-catalog-grid">
            {visibleItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={isSelected ? "interior-product-card is-selected" : "interior-product-card"}
                  onClick={() => onToggle(item.id)}
                  aria-pressed={isSelected}
                  disabled={!isSelected && limitReached}
                >
                  <span className="interior-product-image">
                    <img src={item.image} alt="" loading="lazy" decoding="async" width="640" height="480" />
                    <span className="interior-product-check">
                      {isSelected ? <Check /> : <span>+</span>}
                    </span>
                  </span>
                  <span className="interior-product-copy">
                    <small>#{item.category}</small>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="interior-catalog-empty">
            <Search />
            <strong>Ничего не найдено</strong>
            <span>Попробуйте изменить запрос или открыть другую категорию.</span>
            <button type="button" onClick={() => { setSearch(""); setCategory("Все"); }}>
              Показать всю коллекцию
            </button>
          </div>
        )}
      </div>

      <aside className="interior-selection-tray" aria-label="Выбранные предметы">
        <div className="interior-selection-tray-inner">
          <div className="interior-selection-summary">
            <ShoppingBag />
            <span>
              <strong>В вашей сцене</strong>
              <small>{selectedItems.length ? `${selectedItems.length} из ${maxSelected} предметов` : "Выберите предметы"}</small>
            </span>
          </div>
          <div className="interior-selection-items">
            {selectedItems.map((item) => (
              <button key={item.id} type="button" onClick={() => onToggle(item.id)} aria-label={`Убрать ${item.title}`}>
                <img src={item.image} alt="" width="72" height="72" />
                <span>{item.title}</span>
                <X />
              </button>
            ))}
          </div>
          <button type="button" className="interior-selection-done" onClick={onDone}>
            Готово
            <Check />
          </button>
        </div>
      </aside>
    </section>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}
