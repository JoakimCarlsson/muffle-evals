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
fn deserialize_datetime() {
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct Settings {
        last_updated: toml::value::Datetime,
        minimum_interval: i64,
    }

    for datetime in [
        "2023-01-15T11:42:14-06:00",
        "2023-01-15T11:42:14",
        "2023-01-15",
        "11:42:14",
    ] {
        let document = format!("last_updated = {datetime}\nminimum_interval = 3600\n");
        let expected: Settings = toml::from_str(&document).unwrap();
        let value: toml::Value = toml::from_str(&document).unwrap();
        assert_eq!(Settings::deserialize(value.clone()).unwrap(), expected);
        assert_eq!(value.clone().try_into::<Settings>().unwrap(), expected);
        let datetime_value = value.get("last_updated").unwrap().clone();
        assert_eq!(
            datetime_value
                .clone()
                .try_into::<toml::value::Datetime>()
                .unwrap(),
            expected.last_updated
        );
        assert_eq!(
            serde_json::Value::deserialize(datetime_value).unwrap(),
            serde_json::Value::String(datetime.to_owned())
        );
    }

    assert!(
        String("2023-01-15".to_owned())
            .try_into::<toml::value::Datetime>()
            .is_err()
    );
}
