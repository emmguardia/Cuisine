export default function TeamMemberCard({ name, role, image }) {
  return (
    <div className="group w-[234px] h-[282px] rounded-3xl bg-white shadow-soft hover:shadow-soft-lg transition-all duration-500 transform hover:-translate-y-2 overflow-hidden">
      <div className="relative h-[172px] mx-6 mt-6 rounded-2xl overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <div className="px-6 pt-4 pb-6">
        <div className="text-center font-semibold text-lg bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent mb-1">
          {name}
        </div>
        <div className="text-center font-medium text-sm text-gray-600">
          {role}
        </div>
      </div>
    </div>
  );
}
