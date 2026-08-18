--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: key_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.key_type AS ENUM (
    'order',
    'product',
    'layer',
    'profile',
    'filling',
    'glass',
    'glunit',
    'layout',
    'mosquito',
    'set',
    'fragment',
    'half_stuff',
    'order_half_stuff',
    'box',
    'other'
);


--
-- Name: keys_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.keys_type AS (
	obj uuid,
	specimen integer,
	elm integer,
	region integer
);


--
-- Name: phases; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.phases AS ENUM (
    'plan',
    'run',
    'ready'
);


--
-- Name: prod_row; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prod_row AS (
	characteristic uuid,
	quantity integer
);


--
-- Name: qinfo_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qinfo_type AS (
	abonent uuid,
	year integer,
	branch uuid,
	barcode bigint,
	ref uuid,
	calc_order uuid,
	characteristic uuid,
	presentation character varying(200),
	specimen integer,
	elm integer,
	region integer,
	type public.key_type,
	leading_product uuid
);


--
-- Name: refs; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refs AS ENUM (
    'cat.accounts',
    'cat.abonents',
    'cat.branches',
    'cat.characteristics',
    'cat.divisions',
    'cat.leads',
    'cat.partners',
    'cat.planning_keys',
    'cat.products',
    'cat.projects',
    'cat.servers',
    'cat.specifications',
    'cat.users',
    'doc.calc_order',
    'doc.planning_event',
    'doc.work_centers_task',
    'doc.work_centers_performance',
    'doc.purchase_order',
    'doc.debit_cash_order',
    'doc.credit_cash_order',
    'doc.credit_card_order',
    'doc.debit_bank_order',
    'doc.credit_bank_order',
    'doc.selling',
    'doc.purchase',
    'doc.nom_prices_setup',
    'doc.inventory_cuts',
    'doc.inventory_goods',
    'doc.scaning',
    'unknown'
);


--
-- Name: qinfo(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qinfo(code character varying) RETURNS public.qinfo_type
    LANGUAGE plpgsql
    AS $$
declare
	tmp qinfo_type;
	keys_row keys%ROWTYPE;
	cx_row characteristics%ROWTYPE;
	order_row calc_orders%ROWTYPE;
	icode bigint;
	ucode uuid;
begin
  /* ищем запись в keys */
  if(char_length(code) = 13) then
	code = substring(code, 1, 12);
  end if;
  if char_length(code) = 12 then
    icode = code;
	SELECT * INTO keys_row FROM keys WHERE barcode=icode;
  elseif char_length(code) = 36 then
    ucode = code;
    SELECT * INTO keys_row FROM keys WHERE ref=ucode;
  end if;

  /* подклеиваем заказ и прочую инфу */
  if keys_row.type is null then
	RAISE NOTICE 'null';
  elseif keys_row.type = 'order' then
	SELECT * INTO order_row FROM calc_orders WHERE ref=keys_row.obj;
  else
	SELECT * INTO cx_row FROM characteristics WHERE ref=keys_row.obj;
	SELECT * INTO order_row FROM calc_orders WHERE ref=cx_row.calc_order;
  end if;
  tmp.abonent = order_row.abonent;
  tmp.year = order_row.year;
  tmp.branch = order_row.branch;
  tmp.calc_order = order_row.ref;

  tmp.characteristic = cx_row.ref;
  tmp.leading_product = cx_row.leading_product;

  tmp.barcode = keys_row.barcode;
  tmp.ref = keys_row.ref;
  tmp.specimen = keys_row.specimen;
  tmp.elm = keys_row.elm;
  tmp.region = keys_row.region;
  tmp.type = keys_row.type;

  if keys_row.type = 'order' then
  	tmp.presentation = format('%s от %s', order_row.number_doc, order_row.date);
  else
  	tmp.presentation = cx_row.name;
  end if;
  return tmp;
end
$$;


--
-- Name: register_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        --
        -- INSERT INTO feed(ref) select ref from keys order by barcode;
        -- для определения типа операции применяется специальная переменная TG_OP.
        --
        IF (TG_OP = 'DELETE') THEN
			INSERT INTO feed(ref) VALUES(OLD.ref);
        ELSE
			INSERT INTO feed(ref) VALUES(NEW.ref);
        END IF;
        RETURN NULL; -- возвращаемое значение для триггера AFTER игнорируется
    END;
$$;


SET default_table_access_method = heap;

--
-- Name: areg_cuttings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_cuttings (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone,
    sign smallint DEFAULT 1,
    work_center uuid,
    nom uuid,
    characteristic uuid,
    len numeric(8,2) DEFAULT 0,
    width numeric(8,2) DEFAULT 0,
    qty integer DEFAULT 0,
    quantity numeric(15,3) DEFAULT 0,
    amount numeric(15,3) DEFAULT 0
);

COMMENT ON TABLE public.areg_cuttings IS 'Деловая обрезь';


--
-- Name: areg_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_dates (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone NOT NULL,
    sign smallint DEFAULT 1 NOT NULL,
    phase public.phases DEFAULT 'plan'::public.phases NOT NULL,
    date date,
    shift uuid,
    work_center uuid,
    planing_key bigint,
    stage uuid,
    part uuid,
    part_type public.refs,
    calc_order uuid,
    power numeric(15,3) DEFAULT 0
);


COMMENT ON TABLE public.areg_dates IS 'Даты планирования (запуск и готовность)';
COMMENT ON COLUMN public.areg_dates.register IS 'Регистратор';
COMMENT ON COLUMN public.areg_dates.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.areg_dates.row_num IS 'Номер строки';
COMMENT ON COLUMN public.areg_dates.period IS 'Период';
COMMENT ON COLUMN public.areg_dates.sign IS 'Вид движения приход-расход';
COMMENT ON COLUMN public.areg_dates.phase IS 'Фаза планирования';
COMMENT ON COLUMN public.areg_dates.date IS 'Дата план или факт';
COMMENT ON COLUMN public.areg_dates.shift IS 'Смена';
COMMENT ON COLUMN public.areg_dates.work_center IS 'Рабочий центр';
COMMENT ON COLUMN public.areg_dates.planing_key IS 'Ключ планирования (barcode)';
COMMENT ON COLUMN public.areg_dates.stage IS 'Этап производства';
COMMENT ON COLUMN public.areg_dates.part IS 'Партия';
COMMENT ON COLUMN public.areg_dates.part IS 'Тип партии';
COMMENT ON COLUMN public.areg_dates.calc_order IS 'Расчёт';
COMMENT ON COLUMN public.areg_dates.power IS 'Мощность';


--
-- Name: areg_needs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_needs (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone,
    sign smallint DEFAULT 1,
    calc_order uuid,
    nom uuid,
    characteristic uuid,
    stage uuid,
    planing_key uuid,
    quantity numeric(15,3) DEFAULT 0
);

COMMENT ON TABLE public.areg_needs IS 'Потребность в материалах';
COMMENT ON COLUMN public.areg_needs.register IS 'Регистратор';
COMMENT ON COLUMN public.areg_needs.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.areg_needs.row_num IS 'Номер строки';
COMMENT ON COLUMN public.areg_needs.period IS 'Период';
COMMENT ON COLUMN public.areg_needs.nom IS 'Номенклатура';
COMMENT ON COLUMN public.areg_needs.characteristic IS 'Характеристика';
COMMENT ON COLUMN public.areg_needs.stage IS 'Этап производства';
COMMENT ON COLUMN public.areg_needs.planing_key IS 'Ключ планирования';
COMMENT ON COLUMN public.areg_needs.quantity IS 'Количество';


--
-- Name: areg_wc_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_wc_performance (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone NOT NULL,
    sign smallint DEFAULT 1 NOT NULL,
    date date,
    shift uuid,
    work_center uuid,
    params uuid,
    power numeric(15,3) DEFAULT 0
);

COMMENT ON TABLE public.areg_wc_performance IS 'Загрузка рабочих центров (план)';
COMMENT ON COLUMN public.areg_wc_performance.register IS 'Регистратор';
COMMENT ON COLUMN public.areg_wc_performance.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.areg_wc_performance.row_num IS 'Номер строки';
COMMENT ON COLUMN public.areg_wc_performance.period IS 'Период';
COMMENT ON COLUMN public.areg_wc_performance.sign IS 'Вид движения приход-расход';
COMMENT ON COLUMN public.areg_wc_performance.date IS 'Дата план';
COMMENT ON COLUMN public.areg_wc_performance.shift IS 'Смена';
COMMENT ON COLUMN public.areg_wc_performance.work_center IS 'Рабочий центр';
COMMENT ON COLUMN public.areg_wc_performance.power IS 'Мощность';


--
-- Name: calc_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_orders (
    ref uuid NOT NULL,
    abonent uuid,
    branch uuid,
    year integer,
    date timestamp without time zone,
    number_doc character(11),
    partner uuid,
    organization uuid,
    author uuid,
    department uuid,
    production jsonb
);

COMMENT ON TABLE public.calc_orders IS 'Расчёты-заказы';


--
-- Name: characteristics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristics (
    ref uuid NOT NULL,
    calc_order uuid,
    leading_product uuid,
    name character varying(200)
);

COMMENT ON TABLE public.characteristics IS 'Характеристики продукции';


--
-- Name: feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed (
    seq bigint NOT NULL,
    ref uuid NOT NULL
);

COMMENT ON TABLE public.feed IS 'Фид ключей для интеграции';


--
-- Name: feed_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_seq_seq OWNED BY public.feed.seq;


--
-- Name: keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keys (
    ref uuid DEFAULT public.uuid_generate_v1mc() NOT NULL,
    obj uuid NOT NULL,
    specimen integer DEFAULT 1,
    elm integer DEFAULT 0,
    region integer DEFAULT 0,
    barcode bigint DEFAULT 0,
    type public.key_type
);

COMMENT ON TABLE public.keys IS 'Ключи планирования';


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    param character varying(100) NOT NULL,
    value jsonb NOT NULL
);

COMMENT ON TABLE public.settings IS 'Настройки и параметры';


--
-- Name: specifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specifications (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    sign smallint DEFAULT 1 NOT NULL,
    product uuid,
    dop integer,
    elm integer,
    region integer,
    stage uuid,
    nom uuid,
    characteristic uuid,
    totqty1 numeric(15,4) DEFAULT 0
);

COMMENT ON TABLE public.specifications IS 'Корректировки спецификаций';
COMMENT ON COLUMN public.specifications.register IS 'Регистратор';
COMMENT ON COLUMN public.specifications.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.specifications.row_num IS 'Номер строки';
COMMENT ON COLUMN public.specifications.sign IS 'Вид движения приход-расход';
COMMENT ON COLUMN public.specifications.product IS 'Изделие';
COMMENT ON COLUMN public.specifications.dop IS 'Тип строки (материал, обрезь, потребность)';
COMMENT ON COLUMN public.specifications.elm IS 'Элемент или слой';
COMMENT ON COLUMN public.specifications.region IS 'Ряд элемента';
COMMENT ON COLUMN public.specifications.stage IS 'Этап производства';
COMMENT ON COLUMN public.specifications.nom IS 'Номенклатура';
COMMENT ON COLUMN public.specifications.characteristic IS 'Характеристика';
COMMENT ON COLUMN public.specifications.totqty1 IS 'Количество';


--
-- Name: feed seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed ALTER COLUMN seq SET DEFAULT nextval('public.feed_seq_seq'::regclass);


--
-- Name: address; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX address ON public.keys USING btree (obj, specimen, elm, region);


--
-- Name: areg_cuttings areg_cuttings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_cuttings
    ADD CONSTRAINT areg_cuttings_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: areg_dates areg_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_dates
    ADD CONSTRAINT areg_dates_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: areg_needs areg_needs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_needs
    ADD CONSTRAINT areg_needs_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: areg_wc_performance areg_wc_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_wc_performance
    ADD CONSTRAINT areg_wc_performance_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: phase_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phase_date ON public.areg_dates USING btree (phase, date) WITH (deduplicate_items='true');


--
-- Name: phase_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phase_part ON public.areg_dates USING btree (phase, part) WITH (deduplicate_items='true');


--
-- Name: specifications specifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specifications
    ADD CONSTRAINT specifications_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: characteristics characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT characteristics_pkey PRIMARY KEY (ref);


--
-- Name: feed feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_pkey PRIMARY KEY (seq);


--
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (ref);


--
-- Name: calc_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ref);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (param);


--
-- Name: barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barcode ON public.keys USING btree (barcode);


--
-- Name: barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barcode_key ON public.areg_dates USING btree (planing_key) WITH (deduplicate_items='true');


--
-- Name: keys register_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER register_change AFTER INSERT OR DELETE OR UPDATE ON public.keys FOR EACH ROW EXECUTE FUNCTION public.register_change();


--
-- Name: characteristics order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT "order" FOREIGN KEY (calc_order) REFERENCES public.calc_orders(ref) NOT VALID;


--
-- PostgreSQL database dump complete
--

