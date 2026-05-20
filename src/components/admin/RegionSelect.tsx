'use client';

import { getCityOptions, getProvinceOptions } from '@/lib/china-regions';

interface RegionSelectProps {
  province?: string | null;
  city?: string | null;
  onChange: (value: { province: string; city: string }) => void;
  provinceLabel?: string;
  cityLabel?: string;
  idPrefix: string;
}

const inputClass = 'w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-500 focus:ring-2 focus:ring-brown-500';

export default function RegionSelect({
  province,
  city,
  onChange,
  provinceLabel = '省份',
  cityLabel = '城市',
  idPrefix,
}: RegionSelectProps) {
  const currentProvince = province || '';
  const currentCity = city || '';
  const provinceOptions = getProvinceOptions(currentProvince);
  const cityOptions = getCityOptions(currentProvince, currentCity);
  const provinceListId = `${idPrefix}-province-list`;
  const cityListId = `${idPrefix}-city-list`;

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-warm-gray-400">{provinceLabel}</label>
        <input
          className={inputClass}
          list={provinceListId}
          value={currentProvince}
          onChange={(event) => {
            const nextProvince = event.target.value;
            onChange({ province: nextProvince, city: nextProvince === currentProvince ? currentCity : '' });
          }}
          placeholder="搜索或选择省份"
        />
        <datalist id={provinceListId}>
          {provinceOptions.map((item) => <option key={item} value={item} />)}
        </datalist>
      </div>
      <div>
        <label className="mb-1 block text-xs text-warm-gray-400">{cityLabel}</label>
        <input
          className={inputClass}
          list={cityListId}
          value={currentCity}
          onChange={(event) => onChange({ province: currentProvince, city: event.target.value })}
          placeholder={currentProvince ? '搜索或选择城市' : '请先选择省份'}
        />
        <datalist id={cityListId}>
          {cityOptions.map((item) => <option key={item} value={item} />)}
        </datalist>
      </div>
    </>
  );
}
