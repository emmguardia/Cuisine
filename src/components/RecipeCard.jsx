export default function RecipeCard({ image, title, description, tags, buttonText, time, difficulty }) {
  return (
    <div className="group relative w-full bg-white rounded-3xl overflow-hidden shadow-soft hover:shadow-soft-lg transition-all duration-500 transform hover:-translate-y-2">
      <div className="relative h-48 overflow-hidden">
        {image ? (
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pastel-peach to-pastel-apricot" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-orange-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {time && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-orange-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {time}
          </div>
        )}
      </div>
      
      <div className="p-6 flex flex-col h-[calc(504px-192px)]">
        <h3 className="text-xl font-semibold mb-3 bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
          {title}
        </h3>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {tags && tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-pastel-peach/50 rounded-full text-xs font-medium text-orange-700"
            >
              {tag}
            </span>
          ))}
          {difficulty && (
            <span className="px-3 py-1 bg-pastel-apricot/50 rounded-full text-xs font-medium text-orange-700">
              {difficulty}
            </span>
          )}
        </div>

        <p className="text-sm leading-relaxed text-gray-600 mb-auto line-clamp-3">
          {description}
        </p>

        <div className="pt-4 mt-auto">
          <a 
            href={`/recette?id=${encodeURIComponent(title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'))}`}
            className="block w-full px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-soft text-center"
          >
            {buttonText || 'Voir la recette'}
          </a>
        </div>
      </div>
    </div>
  );
}
