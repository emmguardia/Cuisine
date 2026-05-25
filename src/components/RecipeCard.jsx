export default function RecipeCard({ recipe, priority = false }) {
  const { image, title, description, tags, time, difficulty } = recipe;

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-cream hover:shadow-warm transition-shadow duration-300">
      <div className="relative h-48 overflow-hidden bg-orange-50">
        {image && (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
          />
        )}
        {time && (
          <div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded-full text-xs font-semibold text-orange-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {time}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col gap-3">
        <h3 className="font-playfair text-lg font-semibold text-warm-900 leading-snug">
          {title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          {tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="font-nunito px-2.5 py-0.5 bg-orange-50 rounded-full text-xs font-semibold text-orange-600">
              {tag}
            </span>
          ))}
          {difficulty && (
            <span className="font-nunito px-2.5 py-0.5 bg-cream-200 rounded-full text-xs font-semibold text-warm-700">
              {difficulty}
            </span>
          )}
        </div>

        <p className="font-nunito text-sm text-warm-600 leading-relaxed line-clamp-3">
          {description}
        </p>

        <a
          href={`/recette?id=${slug}`}
          className="mt-auto btn-primary text-center text-sm py-2.5"
        >
          Voir la recette
        </a>
      </div>
    </div>
  );
}
