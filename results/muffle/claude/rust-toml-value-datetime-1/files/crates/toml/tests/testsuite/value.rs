use snapbox::assert_data_eq;
use snapbox::prelude::*;
use snapbox::str;

use toml::Value::{Array, Boolean, Float, Integer, String, Table};
use toml::map::Map;

#[test]
fn display() {
    assert_data_eq!(
        String("foo".to_owned()).to_string(),
        str![[r#""foo""#]].raw()
    );
    assert_data_eq!(Integer(10).to_string(), str!["10"].raw());
    assert_data_eq!(Float(10.0).to_string(), str!["10.0"].raw());
    assert_data_eq!(Float(2.4).to_string(), str!["2.4"].raw());
    assert_data_eq!(Boolean(true).to_string(), str!["true"].raw());
    assert_data_eq!(Array(vec![]).to_string(), str!["[]"].raw());
    assert_data_eq!(
        Array(vec![Integer(1), Integer(2)]).to_string(),
        str!["[1, 2]"].raw()
    );
    assert_data_eq!(
        Table(map! {"test" => Integer (2), "test2" => Integer(3)}).to_string(),
        str!["{ test = 2, test2 = 3 }"].raw()
    );
}

#[test]
fn deserialize_datetime_from_value() {
    #[derive(serde::Deserialize)]
    struct Settings {
        last_updated: toml::value::Datetime,
        minimum_interval: i64,
    }

    let v: toml::Table = toml::from_str(
        "[settings]\nlast_updated = 2023-01-15T11:42:14-06:00\nminimum_interval = 3600\n",
    )
    .unwrap();
    let s = v["settings"].clone().try_into::<Settings>().unwrap();
    assert_eq!(s.last_updated.to_string(), "2023-01-15T11:42:14-06:00");
    assert_eq!(s.minimum_interval, 3600);

    let d = toml::Value::Datetime("1979-05-27".parse().unwrap())
        .try_into::<toml::value::Datetime>()
        .unwrap();
    assert_eq!(d.to_string(), "1979-05-27");
}
