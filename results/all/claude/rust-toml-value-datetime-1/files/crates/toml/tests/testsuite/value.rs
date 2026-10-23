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
fn datetime_from_value() {
    #[derive(serde::Deserialize)]
    struct Settings {
        last_updated: toml::value::Datetime,
    }

    let v: toml::Table = toml::from_str("last_updated = 2023-01-15T11:42:14-06:00").unwrap();
    let s = <Settings as serde::Deserialize>::deserialize(toml::Value::Table(v.clone())).unwrap();
    assert_eq!(s.last_updated.to_string(), "2023-01-15T11:42:14-06:00");
    let d = toml::Value::try_into::<toml::value::Datetime>(v["last_updated"].clone()).unwrap();
    assert_eq!(d.to_string(), "2023-01-15T11:42:14-06:00");
}
